import { Module } from "@nestjs/common";
import { CitationFactory } from "./citation.factory.js";

@Module({ providers: [CitationFactory], exports: [CitationFactory] })
export class CitationsModule {}
