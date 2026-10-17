import { Controller, Get, Module } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * Erweiterungspunkt für einen späteren, OPTIONALEN KI-Assistenten.
 * SATZIO funktioniert vollständig ohne KI. Es gibt bewusst keine
 * simulierten Antworten. Ein Provider kann später z. B. Pläne erklären oder
 * Notizen strukturieren – die App zeigt die Funktion erst an, wenn
 * `enabled` true ist.
 */
export interface AssistantProvider {
  readonly name: string;
  explainPlan?(planJson: unknown): Promise<string>;
  summarizeProgress?(statsJson: unknown): Promise<string>;
  structureNotes?(text: string): Promise<string>;
  suggestAlternatives?(exerciseSlug: string): Promise<string[]>;
}

export const ASSISTANT_PROVIDER = Symbol('ASSISTANT_PROVIDER');

@ApiTags('Assistant')
@ApiBearerAuth()
@Controller('assistant')
export class AssistantController {
  @Get('status')
  @ApiOperation({ summary: 'Ist ein KI-Assistent konfiguriert? (Standard: nein)' })
  status() {
    return { enabled: false, provider: null, capabilities: [] as string[] };
  }
}

@Module({ controllers: [AssistantController] })
export class AssistantModule {}
