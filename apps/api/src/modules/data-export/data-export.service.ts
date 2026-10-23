import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DataExportRepository } from './data-export.repository';
import {
  EXPORT_COLLECTIONS,
  type ExportCollection,
  type ResearchDataExport,
} from './data-export.types';

@Injectable()
export class DataExportService {
  constructor(private readonly repository: DataExportRepository) {}

  async exportForCaller(userId: string): Promise<ResearchDataExport> {
    const collections = await this.repository.readResearchData(userId);
    const counts = {} as Record<ExportCollection, number>;

    for (const collection of EXPORT_COLLECTIONS) {
      if (!Array.isArray(collections[collection])) {
        throw new InternalServerErrorException(
          'The export could not be completed. Please try again.',
        );
      }

      counts[collection] = collections[collection].length;
    }

    return {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      scope: 'accessible-research-data',
      includesRetainedArchivedRecords: true,
      collections,
      counts,
    };
  }
}
