import { Body, Controller, Post } from '@nestjs/common';
import { AskService, type AskResult } from './ask.service.js';
import {
  DocumentIndexService,
  type IndexDocumentResult,
} from './document-index.service.js';
import { AskDto, IndexDocumentDto } from './dto/ai.dto.js';

@Controller('ai')
export class AIController {
  constructor(
    private readonly documentIndexService: DocumentIndexService,
    private readonly askService: AskService,
  ) {}

  @Post('index-document')
  async indexDocument(@Body() dto: IndexDocumentDto): Promise<IndexDocumentResult> {
    return this.documentIndexService.indexDocument(dto);
  }

  @Post('ask')
  async ask(@Body() dto: AskDto): Promise<AskResult> {
    return this.askService.ask(dto);
  }
}
