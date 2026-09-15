import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PlaceResult, TripPlan } from "@koreamate/contracts";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { PlacesService } from "../places/places.service.js";
import {
  TRAVEL_PROVIDER,
  TravelProviderNotConfiguredError,
  PendingFieldSchema,
  TripRequirementsSchema,
  type TravelProvider,
} from "./travel-provider.js";
import { applyContextAnswer, inferPendingField } from "./context-answer.js";
import { TripContextService, type TripContext } from "./trip-context.service.js";
import { GuideImportService } from "./guide-import.service.js";

type TravelJob = { jobId: string; conversationId: string; sourceMessageId: string; text: string; images?: string[] };
type PlannedItem = { time: string; title: string; description: string; estimatedCost: number; placeQuery: string | null; place: PlaceResult | null };
type PlannedDay = { dayNumber: number; date: string | null; title: string; items: PlannedItem[]; estimatedCost: number };
type StoredItem = { id: string; startTime: string; title: string; description: string; estimatedCost: unknown; currency: string; place: null | { name: string; address: string | null; latitude: unknown; longitude: unknown; sources: Array<{ sourceUrl: string | null }> } };

@Injectable()
export class TravelService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TRAVEL_PROVIDER) private readonly provider: TravelProvider,
    private readonly places: PlacesService,
    private readonly tripContext: TripContextService,
    private readonly guideImport: GuideImportService,
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
      const result = await this.provider.plan({
        message: job.text,
        requirements: contextualRequirements,
        previousPlan: previous ? this.toPreviousPlan(previous) : null,
        pendingField,
        today,
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
      const totalCost = days.reduce((sum, day) => sum + day.estimatedCost, 0);
      const versionNumber = (previous?.versionNumber ?? 0) + 1;
      const version = await this.prisma.$transaction(async (transaction) => {
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
          include: { days: { orderBy: { dayNumber: "asc" }, include: { items: { orderBy: { startTime: "asc" }, include: { place: { include: { sources: { where: { provider: "kakao" }, orderBy: { fetchedAt: "desc" }, take: 1 } } } } } } } },
        });
        await transaction.trip.update({ where: { id: trip.id }, data: { title: result.title } });
        await transaction.message.create({
          data: { conversationId: job.conversationId, role: "ASSISTANT", contentType: "TEXT", content: { tripVersionId: created.id } },
        });
        return created;
      });

      await this.appendEvent(job.jobId, "travel.plan.ready", { plan: this.toContract(trip.id, version, context) });
      await this.finish(job.jobId, "COMPLETED", "job.completed", { stage: "TRAVEL_PLAN_READY" });
    } catch (error) {
      const notConfigured = error instanceof TravelProviderNotConfiguredError;
      await this.finish(job.jobId, "FAILED", "job.failed", {
        code: notConfigured ? "TRAVEL_PROVIDER_NOT_CONFIGURED" : "TRAVEL_PROVIDER_FAILED",
        message: notConfigured ? "旅行规划服务还没有配置 API Key。" : "旅行规划暂时不可用，请稍后重试。",
      });
    }
  }

  async restore(tripId: string, versionId: string): Promise<TripPlan> {
    const source = await this.prisma.tripVersion.findFirst({
      where: { id: versionId, tripId },
      include: { days: { orderBy: { dayNumber: "asc" }, include: { items: { orderBy: { startTime: "asc" }, include: { place: { include: { sources: { where: { provider: "kakao" }, orderBy: { fetchedAt: "desc" }, take: 1 } } } } } } } },
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
      include: { days: { orderBy: { dayNumber: "asc" }, include: { items: { orderBy: { startTime: "asc" }, include: { place: { include: { sources: { where: { provider: "kakao" }, orderBy: { fetchedAt: "desc" }, take: 1 } } } } } } } },
    });
    return this.toContract(tripId, restored);
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

  private toContract(tripId: string, version: { id: string; versionNumber: number; title: string; summary: string; currency: string; totalCost: unknown; days: Array<{ dayNumber: number; date: Date | null; title: string; estimatedCost: unknown; items: StoredItem[] }> }, context: TripContext = { weather: null, exchangeRate: null }): TripPlan {
    return { tripId, versionId: version.id, versionNumber: version.versionNumber, title: version.title, summary: version.summary, currency: version.currency, totalEstimatedCost: Number(version.totalCost), weather: context.weather, exchangeRate: context.exchangeRate, days: version.days.map((day) => ({ dayNumber: day.dayNumber, date: day.date?.toISOString().slice(0, 10) ?? null, title: day.title, estimatedCost: Number(day.estimatedCost), items: day.items.map((item) => ({ id: item.id, time: item.startTime, title: item.title, description: item.description, estimatedCost: Number(item.estimatedCost), currency: item.currency, place: item.place ? { name: item.place.name, address: item.place.address, latitude: Number(item.place.latitude), longitude: Number(item.place.longitude), mapUrl: item.place.sources[0]?.sourceUrl ?? null } : null })) })) };
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
