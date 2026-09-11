import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNotEmpty, IsNumber, IsString, Max, MaxLength, Min } from 'class-validator'

export class TextTranslationDto {
  @IsString() @IsNotEmpty() @IsIn(['zh-CN', 'ko-KR', 'en-US']) sourceLanguage!: string
  @IsString() @IsNotEmpty() @IsIn(['zh-CN', 'ko-KR', 'en-US']) targetLanguage!: string
  @IsString() @IsNotEmpty() @MaxLength(3000) text!: string
}

export class CreateTravelPlanDto {
  @IsString() @IsNotEmpty() cityId!: string
  @IsInt() @Min(1) @Max(14) days!: number
  @IsInt() @Min(1) @Max(10) people!: number
  @IsNumber() @Min(0) budget!: number
  @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) interests!: string[]
  @IsString() @MaxLength(500) note = ''
}
