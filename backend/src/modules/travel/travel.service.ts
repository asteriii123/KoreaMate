import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { FlightOption, HotelOption, PlaceResult, TripPlan } from "@koreamate/contracts";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { PlacesService } from "../places/places.service.js";
import {
  TRAVEL_PROVIDER,
  TravelProviderNotConfiguredError,
  PendingFieldSchema,
  TripRequirementsSchema,
  type TravelProvider,
  type TravelMemoryContext,
} from "./travel-provider.js";
import { applyContextAnswer, inferPendingField } from "./context-answer.js";
import { TripContextService, type TripContext } from "./trip-context.service.js";
import { GuideImportService } from "./guide-import.service.js";
import { HotelMcpProvider } from "./hotel-mcp.provider.js";
import { FlightMcpProvider } from "./flight-mcp.provider.js";
import { SavedPlacesService } from "../saved-places/saved-places.service.js";
import type { Identity } from "../auth/identity.service.js";
import { MemoryService } from "../memory/memory.service.js";
import { OpenAiCompatibleMemoryExtractor } from "../memory/openai-compatible-memory.extractor.js";
import { CitationFactory } from "../citations/citation.factory.js";

type TravelJob = { jobId: string; conversationId: string; sourceMessageId: string; text: string; images?: string[] };
type PlannedItem = { time: string; title: string; description: string; estimatedCost: number; placeQuery: string | null; place: PlaceResult | null };
type PlannedDay = { dayNumber: number; date: string | null; title: string; items: PlannedItem[]; estimatedCost: number };
type StoredItem = { id: string; startTime: string; title: string; description: string; estimatedCost: unknown; currency: string; place: null | { id: string; name: string; nameZh: string | null; address: string | null; latitude: unknown; longitude: unknown; sources: Array<{ provider: string; sourceUrl: string | null; fetchedAt: Date; expiresAt: Date }> } };

@Injectable()
export class TravelService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TRAVEL_PROVIDER) private readonly provider: TravelProvider,
    private readonly places: PlacesService,
    private readonly tripContext: TripContextService,
    private readonly guideImport: GuideImportService,
    private readonly hotels: HotelMcpProvider,
    private readonly flights: FlightMcpProvider,
    private readonly savedPlaces: SavedPlacesService,
    private readonly memories: MemoryService,
    private readonly memoryExtractor: OpenAiCompatibleMemoryExtractor,
    private readonly citations: CitationFactory,
  ) {}

  async process(job: TravelJob): Promise<void> {
    try {
      await this.appendEvent(job.jobId, "travel.started", { message: "正在整理旅行需求…" });
      const trip = await this.prisma.trip.upsert({
        where: { conversationId: job.conversationId },
        create: { conversationId: job.conversationId },
        update: {},
        include: {
          requirement: true,
          versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { days: { orderBy: { dayNumber: "asc" }, include: { items: { orderBy: { startTime: "asc" } } } } } },
        },
      });
      const requirements = trip.requirement ? TripRequirementsSchema.parse(trip.requirement.data) : null;
      const pendingField = trip.requirement?.pendingField
        ? PendingFieldSchema.parse(trip.requirement.pendingField)
        : null;
      const contextualRequirements = applyContextAnswer(requirements, pendingField, job.text);
      const previous = trip.versions[0] ?? null;
      const today = new Date().toISOString().slice(0, 10);
      const identity = await this.conversationIdentity(job.conversationId);
      if (await this.handleMemoryIntent(job, identity)) return;
      if (await this.handleSavedPlaceIntent(job, previous?.id ?? null)) return;
      const memoryCandidates = await this.memoryExtractor.extract(job.text).catch(() => []);
      if (memoryCandidates.length > 0) {
        await this.memories.upsertCandidates(identity, memoryCandidates, job.sourceMessageId).then(async (saved) => {
          const summary = saved.map((item) => this.memoryLabel(item.kind, item.value)).join("、");
          await this.appendEvent(job.jobId, "travel.memory.updated", { action: "saved", summary });
        }).catch(() => undefined);
      }
      const memory = await this.memoryContext(identity).catch(() => this.emptyMemory());
      if (previous && this.isConfirmation(job.text)) {
        await this.prisma.$transaction([
          this.prisma.trip.update({ where: { id: trip.id }, data: { confirmedVersionId: previous.id, confirmedAt: new Date() } }),
          this.prisma.message.create({ data: { conversationId: job.conversationId, role: "ASSISTANT", contentType: "TEXT", content: { text: "行程已确认，已经放进“开始出发吧”。" } } }),
        ]);
        await this.appendEvent(job.jobId, "travel.trip.confirmed", { tripId: trip.id, versionId: previous.id });
        await this.finish(job.jobId, "COMPLETED", "job.completed", { stage: "TRAVEL_CONFIRMED" });
        return;
      }
      if ((job.images?.length ?? 0) > 0 || this.hasGuideUrl(job.text)) {
        const preview = await this.guideImport.parse({ tripId: trip.id, text: job.text, images: job.images ?? [] });
        await this.prisma.message.create({ data: { conversationId: job.conversationId, role: "ASSISTANT", contentType: "TEXT", content: { guideImportId: preview.id } } });
        await this.appendEvent(job.jobId, "travel.import.ready", { preview });
        await this.finish(job.jobId, "COMPLETED", "job.completed", { stage: "TRAVEL_IMPORT_READY" });
        return;
      }
      if (previous && this.isWeatherQuestion(job.text)) {
        await this.answerWeatherQuestion(job, trip.id, requirements?.destination ?? null, today);
        return;
      }
      if (this.isHotelQuestion(job.text)) {
        await this.answerHotelQuestion(job, trip.id, requirements);
        return;
      }
      if (this.isFlightQuestion(job.text)) {
        await this.answerFlightQuestion(job, trip.id, requirements);
        return;
      }
      const result = await this.provider.plan({
        message: job.text,
        requirements: contextualRequirements,
        previousPlan: previous ? this.toPreviousPlan(previous) : null,
        pendingField,
        today,
        memory,
      });

      const resolvedRequirements = pendingField && contextualRequirements?.[pendingField] != null
        ? { ...result.requirements, [pendingField]: contextualRequirements[pendingField] }
        : result.requirements;
      const nextPendingField = result.kind === "question"
        ? inferPendingField(result.question, resolvedRequirements)
        : null;
      await this.prisma.tripRequirement.upsert({
        where: { tripId: trip.id },
        create: { tripId: trip.id, data: resolvedRequirements, pendingField: nextPendingField },
        update: { data: resolvedRequirements, pendingField: nextPendingField },
      });

      if (result.kind === "question") {
        await this.prisma.message.create({
          data: { conversationId: job.conversationId, role: "ASSISTANT", contentType: "TEXT", content: { text: result.question } },
        });
        await this.appendEvent(job.jobId, "travel.question", { question: result.question });
        await this.finish(job.jobId, "COMPLETED", "job.completed", { stage: "TRAVEL_QUESTION" });
        return;
      }

      const normalizedDays = this.normalizeDays(result.days, resolvedRequirements.startDate, resolvedRequirements.days);
      const days = await this.enrichDays(normalizedDays);
      const firstPlace = days.flatMap((day) => day.items).find((item) => item.place)?.place ?? null;
      const context = await this.tripContext.load({ tripId: trip.id, latitude: firstPlace?.latitude ?? null, longitude: firstPlace?.longitude ?? null, startDate: resolvedRequirements.startDate, tripDays: days.length, currency: resolvedRequirements.currency, today });
      const [hotelOptions, flightOptions] = await Promise.all([
        resolvedRequirements.destination && resolvedRequirements.startDate
          ? this.loadHotels(trip.id, resolvedRequirements.destination, resolvedRequirements.startDate, this.addDays(resolvedRequirements.startDate, Math.max(1, days.length - 1)), resolvedRequirements.travelers ?? 1, job.text)
          : Promise.resolve([]),
        resolvedRequirements.departureCity && resolvedRequirements.destination && resolvedRequirements.startDate
          ? this.loadFlights(trip.id, resolvedRequirements.departureCity, resolvedRequirements.destination, resolvedRequirements.startDate)
          : Promise.resolve([]),
      ]);
      const totalCost = days.reduce((sum, day) => sum + day.estimatedCost, 0);
      const versionNumber = (previous?.versionNumber ?? 0) + 1;
      const version = await this.prisma.$transaction(async (transaction) => {
        await Promise.all(days.flatMap((day) => day.items).filter((item) => item.place).map((item) => transaction.place.updateMany({ where: { id: item.place!.id, nameZh: null }, data: { nameZh: item.title } })));
        const created = await transaction.tripVersion.create({
          data: {
            tripId: trip.id,
            versionNumber,
            title: result.title,
            summary: result.summary,
            currency: resolvedRequirements.currency,
            totalCost,
            days: {
              create: days.map((day) => ({
                dayNumber: day.dayNumber,
                date: day.date ? new Date(`${day.date}T00:00:00.000Z`) : null,
                title: day.title,
                estimatedCost: day.estimatedCost,
                items: { create: day.items.map((item) => ({ startTime: item.time, title: item.title, description: item.description, estimatedCost: item.estimatedCost, currency: resolvedRequirements.currency, placeId: item.place?.id ?? null })) },
              })),
            },
          },
          include: { days: { orderBy: { dayNumber: "asc" }, include: { items: { orderBy: { startTime: "asc" }, include: { place: { include: { sources: { where: { provider: { in: ["kakao", "korea-tourism"] } }, orderBy: { fetchedAt: "desc" }, take: 1 } } } } } } } },
        });
        await transaction.trip.update({ where: { id: trip.id }, data: { title: result.title } });
        await transaction.message.create({
          data: { conversationId: job.conversationId, role: "ASSISTANT", contentType: "TEXT", content: { tripVersionId: created.id } },
        });
        return created;
      });

      await this.appendEvent(job.jobId, "travel.plan.ready", { plan: this.toContract(trip.id, version, context, hotelOptions.slice(0, 3), flightOptions.slice(0, 3)) });
      await this.finish(job.jobId, "COMPLETED", "job.completed", { stage: "TRAVEL_PLAN_READY" });
    } catch (error) {
      const notConfigured = error instanceof TravelProviderNotConfiguredError;
      await this.finish(job.jobId, "FAILED", "job.failed", {
        code: notConfigured ? "TRAVEL_PROVIDER_NOT_CONFIGURED" : "TRAVEL_PROVIDER_FAILED",
        message: notConfigured ? "旅行规划服务还没有配置 API Key。" : "旅行规划暂时不可用，请稍后重试。",
      });
    }
  }

  async restore(tripId: string, versionId: string, owner?: { userId?: string | null; guestId?: string | null }): Promise<TripPlan> {
    const source = await this.prisma.tripVersion.findFirst({
      where: { id: versionId, tripId, ...(owner ? { trip: { conversation: owner.userId ? { userId: owner.userId } : { guestId: owner.guestId ?? "00000000-0000-0000-0000-000000000000" } } } : {}) },
      include: { days: { orderBy: { dayNumber: "asc" }, include: { items: { orderBy: { startTime: "asc" }, include: { place: { include: { sources: { where: { provider: { in: ["kakao", "korea-tourism"] } }, orderBy: { fetchedAt: "desc" }, take: 1 } } } } } } } },
    });
    if (!source) throw new NotFoundException("Trip version not found");
    const aggregate = await this.prisma.tripVersion.aggregate({ where: { tripId }, _max: { versionNumber: true } });
    const restored = await this.prisma.tripVersion.create({
      data: {
        tripId,
        versionNumber: (aggregate._max.versionNumber ?? 0) + 1,
        title: source.title,
        summary: source.summary,
        currency: source.currency,
        totalCost: source.totalCost,
        days: { create: source.days.map((day) => ({
          dayNumber: day.dayNumber,
          date: day.date,
          title: day.title,
          estimatedCost: day.estimatedCost,
          items: { create: day.items.map((item) => ({ startTime: item.startTime, title: item.title, description: item.description, estimatedCost: item.estimatedCost, currency: item.currency, placeId: item.placeId })) },
        })) },
      },
      include: { days: { orderBy: { dayNumber: "asc" }, include: { items: { orderBy: { startTime: "asc" }, include: { place: { include: { sources: { where: { provider: { in: ["kakao", "korea-tourism"] } }, orderBy: { fetchedAt: "desc" }, take: 1 } } } } } } } },
    });
    return this.toContract(tripId, restored);
  }

  async latestForConversation(conversationId: string): Promise<TripPlan | null> {
    const trip = await this.prisma.trip.findUnique({ where: { conversationId }, include: { versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { days: { orderBy: { dayNumber: "asc" }, include: { items: { orderBy: { startTime: "asc" }, include: { place: { include: { sources: { where: { provider: { in: ["kakao", "korea-tourism"] } }, orderBy: { fetchedAt: "desc" }, take: 1 } } } } } } } } } } });
    const version = trip?.versions[0];
    return trip && version ? this.toContract(trip.id, version) : null;
  }

  async confirm(tripId: string, versionId: string, owner: { userId?: string | null; guestId?: string | null }): Promise<{ ok: true }> {
    const trip = await this.prisma.trip.findFirst({ where: { id: tripId, conversation: owner.userId ? { userId: owner.userId } : { guestId: owner.guestId ?? "00000000-0000-0000-0000-000000000000" }, versions: { some: { id: versionId } } } });
    if (!trip) throw new NotFoundException("Trip not found");
    await this.prisma.trip.update({ where: { id: tripId }, data: { confirmedVersionId: versionId, confirmedAt: new Date() } });
    return { ok: true };
  }

  async confirmed(owner: { userId?: string | null; guestId?: string | null }): Promise<Array<{ tripId: string; title: string; confirmedAt: string; plan: TripPlan }>> {
    const trips = await this.prisma.trip.findMany({ where: { confirmedAt: { not: null }, conversation: owner.userId ? { userId: owner.userId } : { guestId: owner.guestId ?? "00000000-0000-0000-0000-000000000000" } }, orderBy: { confirmedAt: "desc" }, include: { versions: { include: { days: { orderBy: { dayNumber: "asc" }, include: { items: { orderBy: { startTime: "asc" }, include: { place: { include: { sources: { where: { provider: { in: ["kakao", "korea-tourism"] } }, orderBy: { fetchedAt: "desc" }, take: 1 } } } } } } } } } } });
    const results = trips.flatMap((trip) => { const version = trip.versions.find((item) => item.id === trip.confirmedVersionId); return version && trip.confirmedAt ? [{ tripId: trip.id, title: trip.title ?? version.title, confirmedAt: trip.confirmedAt.toISOString(), plan: this.toContract(trip.id, version) }] : []; });
    const today = new Date().toISOString().slice(0, 10);
    return results.sort((a, b) => {
      const aDate = a.plan.days[0]?.date ?? "9999-12-31"; const bDate = b.plan.days[0]?.date ?? "9999-12-31";
      const aPast = aDate < today; const bPast = bDate < today;
      if (aPast !== bPast) return aPast ? 1 : -1;
      return aPast ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate);
    });
  }

  private normalizeDays(days: Array<{ dayNumber: number; date: string | null; title: string; items: Array<Omit<PlannedItem, "place">> }>, startDate: string | null, expectedDays: number | null): PlannedDay[] {
    if (expectedDays !== null && days.length !== expectedDays) throw new Error("Planner returned the wrong number of days");
    return days.map((day, index) => {
      if (day.dayNumber !== index + 1) throw new Error("Planner returned non-sequential day numbers");
      const date = startDate ? this.addDays(startDate, index) : day.date;
      const items = [...day.items].sort((a, b) => a.time.localeCompare(b.time)).map((item) => ({ ...item, place: null }));
      return { ...day, date, items, estimatedCost: items.reduce((sum, item) => sum + item.estimatedCost, 0) };
    });
  }

  private async enrichDays(days: PlannedDay[]): Promise<PlannedDay[]> {
    const searches = new Map<string, Promise<PlaceResult | null>>();
    const findPlace = (query: string): Promise<PlaceResult | null> => {
      const existing = searches.get(query);
      if (existing) return existing;
      const pending = this.places.search(query, "kakao").then((results) => results[0] ?? null).catch(() => null);
      searches.set(query, pending);
      return pending;
    };
    return Promise.all(days.map(async (day) => ({
      ...day,
      items: await Promise.all(day.items.map(async (item) => ({
        ...item,
        place: item.placeQuery && this.isPlaceActivity(item.title) ? await findPlace(item.placeQuery) : null,
      }))),
    })));
  }

  private isPlaceActivity(title: string): boolean {
    return !/^(步行|散步|乘坐|搭乘|前往|返回|出发|抵达|休息|自由活动|办理入住|办理退房|交通|早餐|午餐|晚餐)(\b|：|:|到|至|前往)?/u.test(title.trim());
  }

  private isWeatherQuestion(text: string): boolean {
    return /(天气|气温|温度|下雨|降雨|带伞|冷不冷|热不热)/u.test(text);
  }

  private isConfirmation(text: string): boolean {
    return /^(?:就按(?:这个|这份|它)?(?:行程)?(?:出发|走|安排)?|确认(?:这个|这份)?行程|确定了|确定这个行程|就这样(?:吧)?|开始出发(?:吧)?)[。！! ]*$/u.test(text.trim());
  }

  private isHotelQuestion(text: string): boolean {
    return /(酒店|住宿|住哪里|住哪儿|民宿)/u.test(text);
  }

  private isFlightQuestion(text: string): boolean {
    return /(航班|机票|飞机票|直飞|转机)/u.test(text);
  }

  private async conversationIdentity(conversationId: string): Promise<Identity> {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { userId: true, guestId: true } });
    return { userId: conversation?.userId ?? null, guestId: conversation?.guestId ?? null };
  }

  private async memoryContext(identity: Identity): Promise<TravelMemoryContext> {
    const { items } = await this.memories.list(identity);
    const one = (kind: typeof items[number]["kind"]): string | null => items.find((item) => item.kind === kind)?.value ?? null;
    const budget = one("budget_level");
    const pace = one("pace");
    return {
      departureCity: one("departure_city"),
      budgetLevel: budget === "economy" || budget === "balanced" || budget === "comfortable" ? budget : null,
      pace: pace === "relaxed" || pace === "balanced" || pace === "packed" ? pace : null,
      interests: items.filter((item) => item.kind === "interest").map((item) => item.value),
      constraints: items.filter((item) => item.kind === "constraint").map((item) => item.value),
    };
  }

  private emptyMemory(): TravelMemoryContext { return { departureCity: null, budgetLevel: null, pace: null, interests: [], constraints: [] }; }

  private memoryLabel(kind: string, value: string): string {
    const labels: Record<string, string> = { departure_city: "常从", budget_level: "预算偏好", pace: "行程节奏", interest: "喜欢", constraint: "需要注意" };
    return `${labels[kind] ?? "偏好"}${value}`;
  }

  private async handleMemoryIntent(job: TravelJob, identity: Identity): Promise<boolean> {
    const text = job.text.trim();
    const viewing = /(你记住了什么|记得什么|我的旅行偏好|我的偏好)/u.test(text);
    const forgetting = /(忘掉|忘记|删除偏好|不要再记住|别再记住)/u.test(text);
    if (!viewing && !forgetting) return false;
    const { items } = await this.memories.list(identity);
    if (viewing) {
      const answer = items.length > 0 ? `我记得：${items.slice(0, 8).map((item) => this.memoryLabel(item.kind, item.value)).join("、")}。你可以点击头像逐项删除。` : "我还没有记住长期旅行偏好。正常规划时，我会逐渐了解你。";
      await this.memoryResponse(job, "travel.memory.updated", { action: "list", answer }, answer);
      return true;
    }
    const query = text.replace(/(请|帮我|把|将|一下|忘掉|忘记|删除偏好|不要再记住|别再记住|这个偏好|吧|。|！|!)/gu, "").trim();
    const exact = items.filter((item) => item.value === query);
    const matches = exact.length > 0 ? exact : items.filter((item) => item.value.includes(query) || query.includes(item.value));
    if (matches.length !== 1) {
      const question = matches.length > 1 ? `你想忘掉哪一项：${matches.slice(0, 3).map((item) => item.value).join("、")}？` : "我没有找到这项长期偏好。";
      await this.memoryResponse(job, "travel.memory.question", { question }, question);
      return true;
    }
    const memory = matches[0]!;
    await this.memories.remove(identity, memory.id);
    const answer = `已忘掉“${memory.value}”这项偏好。`;
    await this.memoryResponse(job, "travel.memory.updated", { action: "removed", memoryId: memory.id, answer }, answer);
    return true;
  }

  private async memoryResponse(job: TravelJob, type: "travel.memory.updated" | "travel.memory.question", data: Prisma.InputJsonValue, text: string): Promise<void> {
    await this.prisma.message.create({ data: { conversationId: job.conversationId, role: "ASSISTANT", contentType: "TEXT", content: { text } } });
    await this.appendEvent(job.jobId, type, data);
    await this.finish(job.jobId, "COMPLETED", "job.completed", { stage: "TRAVEL_MEMORY" });
  }

  private async handleSavedPlaceIntent(job: TravelJob, versionId: string | null): Promise<boolean> {
    const text = job.text.trim();
    const viewing = /(我收藏的|我的收藏|收藏了哪些|收藏了什么|收藏列表)/u.test(text);
    const removing = /(取消收藏|不要收藏|移出收藏)/u.test(text);
    const saving = /(收藏|记住|保存).*(地方|地点|景点|餐厅|咖啡|宫|洞|村|塔|岛|店)?/u.test(text);
    if (!viewing && !removing && !saving) return false;
    const conversation = await this.prisma.conversation.findUnique({ where: { id: job.conversationId }, select: { userId: true, guestId: true } });
    const identity: Identity = { userId: conversation?.userId ?? null, guestId: conversation?.guestId ?? null };
    if (viewing) {
      const { items } = await this.savedPlaces.list(identity);
      const answer = items.length ? `你收藏了：${items.slice(0, 5).map((item) => item.nameZh ?? item.name).join("、")}。可以到“我的收藏”查看全部。` : "你还没有收藏地点，可以在行程里点爱心，或者告诉我“记住这个地方”。";
      await this.savedPlaceResponse(job, "travel.saved-place.ready", { action: "list", answer }, answer);
      return true;
    }
    if (!versionId) {
      const answer = "当前还没有可收藏的核验地点，请先生成一份行程。";
      await this.savedPlaceResponse(job, "travel.saved-place.question", { question: answer }, answer);
      return true;
    }
    const candidates = await this.prisma.itineraryItem.findMany({ where: { itineraryDay: { tripVersionId: versionId }, placeId: { not: null } }, orderBy: [{ itineraryDay: { dayNumber: "asc" } }, { startTime: "asc" }], include: { place: true } });
    const query = text.replace(/(请|帮我|把|将|一下|这个地方|这个地点|刚才那个|取消收藏|不要收藏|移出收藏|收藏|记住|保存|起来|吧|。|！|!)/gu, "").trim();
    const exactMatches = query ? candidates.filter((item) => [item.title, item.place?.name, item.place?.nameZh].some((name) => name === query)) : [];
    const filtered = query
      ? exactMatches.length > 0 ? exactMatches : candidates.filter((item) => [item.title, item.place?.name, item.place?.nameZh].some((name) => Boolean(name) && (name!.includes(query) || query.includes(name!))))
      : candidates;
    const uniqueMatches = [...new Map(filtered.filter((item) => item.place).map((item) => [item.placeId!, item])).values()];
    const matches = query ? uniqueMatches : uniqueMatches.slice(-1);
    if (matches.length !== 1) {
      const names = matches.length > 1 ? matches.slice(0, 3).map((item) => item.place?.nameZh ?? item.title).join("、") : "";
      const question = names ? `你想操作哪个地点：${names}？` : "我没找到这个已核验地点，请说出行程卡片里的地点名称。";
      await this.savedPlaceResponse(job, "travel.saved-place.question", { question }, question);
      return true;
    }
    const selected = matches[0];
    if (!selected?.place) return false;
    const place = selected.place;
    const displayName = place.nameZh ?? selected.title;
    if (removing) {
      await this.savedPlaces.removePlace(identity, place.id);
      const answer = `已取消收藏“${displayName}”。`;
      await this.savedPlaceResponse(job, "travel.saved-place.ready", { action: "removed", placeId: place.id, answer }, answer);
    } else {
      const savedPlace = await this.savedPlaces.create(identity, place.id);
      const answer = `已收藏“${displayName}”。`;
      await this.savedPlaceResponse(job, "travel.saved-place.ready", { action: "saved", savedPlace, answer }, answer);
    }
    return true;
  }

  private async savedPlaceResponse(job: TravelJob, type: "travel.saved-place.ready" | "travel.saved-place.question", data: Prisma.InputJsonValue, text: string): Promise<void> {
    await this.prisma.message.create({ data: { conversationId: job.conversationId, role: "ASSISTANT", contentType: "TEXT", content: { text } } });
    await this.appendEvent(job.jobId, type, data);
    await this.finish(job.jobId, "COMPLETED", "job.completed", { stage: "TRAVEL_SAVED_PLACE" });
  }

  private async answerHotelQuestion(job: TravelJob, tripId: string, requirements: { destination: string | null; startDate: string | null; days: number | null; travelers: number | null } | null): Promise<void> {
    if (!requirements?.destination || !requirements.startDate) {
      const answer = "告诉我入住城市和日期，我就能查询实时酒店。";
      await this.prisma.message.create({ data: { conversationId: job.conversationId, role: "ASSISTANT", contentType: "TEXT", content: { text: answer } } });
      await this.appendEvent(job.jobId, "travel.answer", { answer });
      await this.finish(job.jobId, "COMPLETED", "job.completed", { stage: "TRAVEL_ANSWER" });
      return;
    }
    const checkOut = this.addDays(requirements.startDate, Math.max(1, (requirements.days ?? 2) - 1));
    const hotels = await this.loadHotels(tripId, requirements.destination, requirements.startDate, checkOut, requirements.travelers ?? 1, job.text);
    if (hotels.length === 0) {
      const answer = "酒店实时查询暂时不可用，现有行程没有被修改。";
      await this.prisma.message.create({ data: { conversationId: job.conversationId, role: "ASSISTANT", contentType: "TEXT", content: { text: answer } } });
      await this.appendEvent(job.jobId, "travel.answer", { answer });
    } else {
      await this.prisma.message.create({ data: { conversationId: job.conversationId, role: "ASSISTANT", contentType: "TEXT", content: { hotels } } });
      await this.appendEvent(job.jobId, "travel.hotel.ready", { result: { provider: "rollinggo-hotel", destination: requirements.destination, checkIn: requirements.startDate, checkOut, fetchedAt: new Date().toISOString(), hotels } });
    }
    await this.finish(job.jobId, "COMPLETED", "job.completed", { stage: "TRAVEL_HOTEL_READY" });
  }

  private async loadHotels(tripId: string, destination: string, checkIn: string, checkOut: string, guests: number, query: string): Promise<HotelOption[]> {
    if (!this.hotels.configured) return [];
    const startedAt = Date.now();
    try {
      const result = await this.hotels.search({ destination, checkIn, checkOut, guests, query });
      await this.prisma.$transaction([
        this.prisma.tripResource.create({ data: { tripId, kind: "hotel", provider: result.provider, query: { destination, checkIn, checkOut, guests }, data: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 30 * 60 * 1_000) } }),
        this.prisma.providerCall.create({ data: { provider: result.provider, operation: "hotel.search", status: "SUCCEEDED", durationMs: Date.now() - startedAt, request: { destination, checkIn, checkOut, guests }, response: { resultCount: result.hotels.length } } }),
      ]);
      return result.hotels;
    } catch {
      await this.prisma.providerCall.create({ data: { provider: "rollinggo-hotel", operation: "hotel.search", status: "FAILED", durationMs: Date.now() - startedAt, errorCode: "PROVIDER_FAILED", request: { destination, checkIn, checkOut, guests } } });
      return [];
    }
  }

  private async answerFlightQuestion(job: TravelJob, tripId: string, requirements: { departureCity: string | null; destination: string | null; startDate: string | null } | null): Promise<void> {
    if (!requirements?.departureCity || !requirements.destination || !requirements.startDate) {
      const answer = "告诉我出发城市、目的地和出发日期，我就能查询实时航班。";
      await this.prisma.message.create({ data: { conversationId: job.conversationId, role: "ASSISTANT", contentType: "TEXT", content: { text: answer } } });
      await this.appendEvent(job.jobId, "travel.answer", { answer });
      await this.finish(job.jobId, "COMPLETED", "job.completed", { stage: "TRAVEL_ANSWER" });
      return;
    }
    const flights = await this.loadFlights(tripId, requirements.departureCity, requirements.destination, requirements.startDate);
    if (flights.length === 0) {
      const answer = "航班实时查询暂时不可用，现有行程没有被修改。";
      await this.prisma.message.create({ data: { conversationId: job.conversationId, role: "ASSISTANT", contentType: "TEXT", content: { text: answer } } });
      await this.appendEvent(job.jobId, "travel.answer", { answer });
    } else {
      const result = { provider: "variflight", fromCity: requirements.departureCity, toCity: requirements.destination, departureDate: requirements.startDate, fetchedAt: new Date().toISOString(), flights };
      await this.prisma.message.create({ data: { conversationId: job.conversationId, role: "ASSISTANT", contentType: "TEXT", content: { flights } } });
      await this.appendEvent(job.jobId, "travel.flight.ready", { result });
    }
    await this.finish(job.jobId, "COMPLETED", "job.completed", { stage: "TRAVEL_FLIGHT_READY" });
  }

  private async loadFlights(tripId: string, fromCity: string, toCity: string, departureDate: string): Promise<FlightOption[]> {
    if (!this.flights.configured) return [];
    const startedAt = Date.now();
    try {
      const result = await this.flights.search({ fromCity, toCity, departureDate });
      await this.prisma.$transaction([
        this.prisma.tripResource.create({ data: { tripId, kind: "flight", provider: result.provider, query: { fromCity, toCity, departureDate }, data: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 15 * 60 * 1_000) } }),
        this.prisma.providerCall.create({ data: { provider: result.provider, operation: "flight.search", status: "SUCCEEDED", durationMs: Date.now() - startedAt, request: { fromCity, toCity, departureDate }, response: { resultCount: result.flights.length } } }),
      ]);
      return result.flights;
    } catch {
      await this.prisma.providerCall.create({ data: { provider: "variflight", operation: "flight.search", status: "FAILED", durationMs: Date.now() - startedAt, errorCode: "PROVIDER_FAILED", request: { fromCity, toCity, departureDate } } });
      return [];
    }
  }

  private hasGuideUrl(text: string): boolean {
    return /https?:\/\/(?:www\.)?(?:xiaohongshu\.com|xhslink\.(?:cn|com))\//iu.test(text);
  }

  private async answerWeatherQuestion(job: TravelJob, tripId: string, currentDestination: string | null, today: string): Promise<void> {
    const explicitDestination = job.text.match(/(?:今天|明天|后天)?\s*([\p{Script=Han}]{2,12}?(?:市|岛|道|区)|首尔|釜山|济州|仁川|大邱|大田|光州|蔚山)(?=.{0,4}(?:天气|气温|温度|下雨|降雨|带伞|冷不冷|热不热))/u)?.[1] ?? null;
    const destination = explicitDestination ?? currentDestination;
    const offset = job.text.includes("后天") ? 2 : job.text.includes("明天") ? 1 : 0;
    const date = this.addDays(today, offset);
    let answer: string;
    if (!destination) {
      answer = "请告诉我想查询韩国哪个城市的天气。";
    } else {
      const place = await this.places.search(destination, "kakao").then((results) => results[0] ?? null).catch(() => null);
      const weather = place
        ? await this.tripContext.loadWeather({ tripId, latitude: place.latitude, longitude: place.longitude, date, today })
        : null;
      const day = weather?.status === "available" ? weather.days[0] : null;
      answer = day
        ? `${destination}${offset === 0 ? "今天" : offset === 1 ? "明天" : "后天"} ${Math.round(day.temperatureMin)}–${Math.round(day.temperatureMax)}°C，降雨概率 ${Math.round(day.precipitationProbability)}%。${day.precipitationProbability >= 40 ? "建议带伞。" : "目前降雨可能性不高。"}`
        : `暂时无法获取${destination}的实时天气，请稍后再试。`;
    }
    await this.prisma.message.create({
      data: { conversationId: job.conversationId, role: "ASSISTANT", contentType: "TEXT", content: { text: answer } },
    });
    await this.appendEvent(job.jobId, "travel.answer", { answer });
    await this.finish(job.jobId, "COMPLETED", "job.completed", { stage: "TRAVEL_ANSWER" });
  }

  private addDays(isoDate: string, amount: number): string {
    const date = new Date(`${isoDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  }

  private toPreviousPlan(version: { title: string; summary: string; currency: string; days: Array<{ dayNumber: number; date: Date | null; title: string; items: Array<{ startTime: string; title: string; description: string; estimatedCost: unknown }> }> }): unknown {
    return { title: version.title, summary: version.summary, currency: version.currency, days: version.days.map((day) => ({ dayNumber: day.dayNumber, date: day.date?.toISOString().slice(0, 10) ?? null, title: day.title, items: day.items.map((item) => ({ time: item.startTime, title: item.title, description: item.description, estimatedCost: Number(item.estimatedCost) })) })) };
  }

  private toContract(tripId: string, version: { id: string; versionNumber: number; title: string; summary: string; currency: string; totalCost: unknown; days: Array<{ dayNumber: number; date: Date | null; title: string; estimatedCost: unknown; items: StoredItem[] }> }, context: TripContext = { weather: null, exchangeRate: null }, hotels: HotelOption[] = [], flights: FlightOption[] = []): TripPlan {
    return { tripId, versionId: version.id, versionNumber: version.versionNumber, title: version.title, summary: version.summary, currency: version.currency, totalEstimatedCost: Number(version.totalCost), weather: context.weather, exchangeRate: context.exchangeRate, hotels, flights, days: version.days.map((day) => ({ dayNumber: day.dayNumber, date: day.date?.toISOString().slice(0, 10) ?? null, title: day.title, estimatedCost: Number(day.estimatedCost), items: day.items.map((item) => {
      const source = item.place?.sources[0];
      const provider = source?.provider === "kakao" || source?.provider === "korea-tourism" ? source.provider : null;
      return { id: item.id, time: item.startTime, title: item.title, description: item.description, estimatedCost: Number(item.estimatedCost), currency: item.currency, place: item.place ? { id: item.place.id, name: item.place.name, nameZh: item.place.nameZh, address: item.place.address, latitude: Number(item.place.latitude), longitude: Number(item.place.longitude), mapUrl: source?.sourceUrl ?? null, saved: false, citation: source && provider ? this.citations.external({ provider, sourceUrl: source.sourceUrl, fetchedAt: source.fetchedAt, expiresAt: source.expiresAt }) : this.citations.assistant() } : null };
    }) })) };
  }

  private async appendEvent(jobId: string, type: string, data: Prisma.InputJsonValue): Promise<void> {
    const aggregate = await this.prisma.jobEvent.aggregate({ where: { jobId }, _max: { sequence: true } });
    await this.prisma.jobEvent.create({ data: { jobId, sequence: (aggregate._max.sequence ?? 0) + 1, type, data } });
  }

  private async finish(jobId: string, status: "COMPLETED" | "FAILED", type: string, data: Prisma.InputJsonValue): Promise<void> {
    await this.appendEvent(jobId, type, data);
    await this.prisma.job.update({ where: { id: jobId }, data: { status } });
  }
}
