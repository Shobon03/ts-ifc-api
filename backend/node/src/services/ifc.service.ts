/* 
Construir uma classe parser da IFC
Analisando o arquivo gerado, podemos encontrar os seguintes itens:

ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]','RevitIdentifiers [ContentGUID: 6d754adf-a67c-46e4-ba98-143cd6be8c1a, VersionGUID: 374edb70-3f7c-4e0f-a9bc-1fa28a9d1dbe, NumberOfSaves: 9]'),'2;1');
FILE_NAME('model-1755441508661-Projeto_Pet_Civil_Arq.ifc','2025-08-17T14:39:31-00:00',(''),(''),'ODA SDAI 24.6','Autodesk Revit 24.3.20.13 (PTB) - IFC 24.3.20.0','');
FILE_SCHEMA(('IFC2X3'));
ENDSEC;

DATA;
#1=IFCORGANIZATION($,'Autodesk Revit 2024 (PTB)',$,$,$);
#2=IFCAPPLICATION(#1,'2024','Autodesk Revit 2024 (PTB)','Revit');
#3=IFCCARTESIANPOINT((0.,0.,0.));
#4=IFCCARTESIANPOINT((0.,0.));
#5=IFCDIRECTION((1.,0.,0.));
...
#32=IFCLOCALPLACEMENT(#79,#31);
#33=IFCPOSTALADDRESS($,$,$,$,('AV. EPIT\X\C1CIO PESSOA, 3014. TAMBAUZINHO SALA 304(83) 8862 5630'),$,'','-7.09940719604492','','-34.8348655700684');
#34=IFCBUILDING('1jTKhVfdn6vBgO53mfGNFh',#18,'',$,$,#32,$,'',.ELEMENT.,$,$,#33);
#35=IFCCARTESIANPOINT((0.,0.,-2.9000000000000004));
#36=IFCAXIS2PLACEMENT3D(#35,$,$);
...

Cada linha é separada por ; 
Cada linha contêm metadados e um identificador único, como #1, #2, etc.
As linhas após o DATA; são os dados do modelo, que podem ser lidos e interpretados.
As linhas possuem as entidades IFC, como IFCPROJECT, IFCBUILDING, IFCLOCALPLACEMENT, etc., que são definidas como abaixo, pela linguagem EXPRESS:
  ENTITY IfcLocalPlacement
    SUBTYPE OF (IfcObjectPlacement);
      RelativePlacement : IfcAxis2Placement;
    WHERE
      WR21 : IfcCorrectLocalPlacement(RelativePlacement, PlacementRelTo);
  END_ENTITY;

A ideia aqui será criar uma classe que possa ler essas linhas e interpretar os dados para validar as entidades IFC.

Declarar interfaces para as entidades IFC, referências e erros de validação./
*/

interface IfcEntity {
  id: number;
  type: string;
  parameters: (string | number | IfcReference | null)[];
  raw: string;
  line: number;
}

interface IfcReference {
  id: number;
  resolved?: IfcEntity;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: ValidationStats;
}

interface ValidationError {
  type: 'SYNTAX' | 'SCHEMA' | 'SEMANTIC';
  entity?: IfcEntity;
  message: string;
  line?: number;
  severity: 'ERROR' | 'WARNING';
}

interface ValidationWarning extends ValidationError {
  severity: 'WARNING';
}

interface ValidationStats {
  totalEntities: number;
  uniqueTypes: number;
  entityCounts: Record<string, number>;
  referenceCounts: {
    total: number;
    resolved: number;
    broken: number;
  };
}

class IfcExpressParser {
  private content: string;
  private entities: Map<number, IfcEntity> = new Map();

  constructor(content: string) {
    this.content = content;
  }

  private extractDataSection(): string {
    const dataSectionMatch = this.content.match(/DATA;\s*([\s\S]*?)ENDSEC;/);
    if (!dataSectionMatch) {
      throw new Error('DATA section not found in IFC file.');
    }
    return dataSectionMatch[1].trim();
  }

  private parseValue(value: string): string | number | IfcReference | null {
    if (value.startsWith('#')) {
      const id = parseInt(value.slice(1), 10);
      return { id } as IfcReference;
    }

    if (value === '$') {
      return null;
    }

    if (!Number.isNaN(Number(value))) {
      return Number(value);
    }

    return value;
  }

  private parseParameters(
    paramString: string,
  ): (string | number | IfcReference | null)[] {
    if (!paramString.trim()) {
      return [];
    }

    const params: (string | number | IfcReference | null)[] = [];
    let currentParam = '';
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < paramString.length; i++) {
      const char = paramString[i];

      if (escaped) {
        currentParam += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        currentParam += char;
        continue;
      }

      if (char === "'" && !escaped) {
        inString = !inString;
        currentParam += char;
        continue;
      }

      if (inString) {
        currentParam += char;
        continue;
      }

      if (char === '(') {
        depth++;
        currentParam += char;
      } else if (char === ')') {
        depth--;
        currentParam += char;
      } else if (char === ',' && depth === 0) {
        params.push(this.parseValue(currentParam.trim()));
        currentParam = '';
      } else {
        currentParam += char;
      }
    }

    if (currentParam.trim()) {
      params.push(this.parseValue(currentParam.trim()));
    }

    return params;
  }

  private tokenizeEntity(line: string, lineNumber: number): IfcEntity | null {
    const entityMatch = line.match(/#(\d+)=([A-Z]+)\((.*)\);/);
    if (!entityMatch) {
      return null; // Invalid entity line
    }

    const id = parseInt(entityMatch[1], 10);
    const type = entityMatch[2];
    const parameters = this.parseParameters(entityMatch[3]);

    return {
      id,
      type,
      parameters,
      raw: line,
      line: lineNumber,
    };
  }

  parse(): Map<number, IfcEntity> {
    const dataSection = this.extractDataSection();
    const lines = dataSection
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    lines.forEach((line, index) => {
      const entity = this.tokenizeEntity(line, index + 1);
      if (entity) {
        this.entities.set(entity.id, entity);
      }
    });

    return this.entities;
  }

  getEntities(): Map<number, IfcEntity> {
    return this.entities;
  }
}

class IfcStructureValidator {
  private entities: Map<number, IfcEntity>;

  constructor(entities: Map<number, IfcEntity>) {
    this.entities = entities;
  }

  private validateUniqueIds(): ValidationError[] {
    const errors: ValidationError[] = [];
    const ids = new Set<number>();

    for (const entity of this.entities.values()) {
      if (ids.has(entity.id)) {
        errors.push({
          type: 'SCHEMA',
          entity,
          message: `Duplicate ID found: ${entity.id}`,
          line: entity.line,
          severity: 'ERROR',
        });
        continue; // Skip further checks for this entity
      }

      ids.add(entity.id);
    }
    return errors;
  }

  private validateReferences(): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const entity of this.entities.values()) {
      for (const param of entity.parameters) {
        if (typeof param === 'object' && 'id' in param) {
          const ref = this.entities.get(param.id);
          if (!ref) {
            errors.push({
              type: 'SEMANTIC',
              entity,
              message: `Broken reference to ID ${param.id}`,
              line: entity.line,
              severity: 'ERROR',
            });
          }
        }
      }
    }

    return errors;
  }

  private validateGlobalIds(): ValidationError[] {
    const errors: ValidationError[] = [];
    const guidPattern = /^[0-9A-Za-z_$]{22}$/;

    for (const entity of this.entities.values()) {
      if (entity.type === 'IFCGLOBALID') {
        const globalId = entity.parameters[0];
        if (typeof globalId === 'string' && !guidPattern.test(globalId)) {
          errors.push({
            type: 'SCHEMA',
            entity,
            message: `Invalid Global ID format: ${globalId}`,
            line: entity.line,
            severity: 'ERROR',
          });
        }
      }
    }

    return errors;
  }

  validate(): ValidationError[] {
    const errors: ValidationError[] = [];

    errors.push(...this.validateUniqueIds());
    errors.push(...this.validateReferences());
    errors.push(...this.validateGlobalIds());

    return errors;
  }
}

class StatisticsGenerator {
  private entities: Map<number, IfcEntity>;

  constructor(entities: Map<number, IfcEntity>) {
    this.entities = entities;
  }

  generate(): ValidationStats {
    const stats: ValidationStats = {
      totalEntities: this.entities.size,
      uniqueTypes: new Set(this.entities.values()).size,
      entityCounts: {},
      referenceCounts: {
        total: 0,
        resolved: 0,
        broken: 0,
      },
    };

    this.entities.forEach((entity) => {
      stats.entityCounts[entity.type] =
        (stats.entityCounts[entity.type] || 0) + 1;

      entity.parameters.forEach((param) => {
        if (typeof param === 'object' && 'id' in param) {
          stats.referenceCounts.total++;
          if (param.resolved) {
            stats.referenceCounts.resolved++;
          } else {
            stats.referenceCounts.broken++;
          }
        }
      });
    });

    return stats;
  }
}

class IfcValidator {
  private parser: IfcExpressParser;
  private entities: Map<number, IfcEntity> = new Map();

  constructor(content: string) {
    this.parser = new IfcExpressParser(content);
  }

  async validate(): Promise<ValidationResult> {
    try {
      this.entities = this.parser.parse();

      const structuralValidator = new IfcStructureValidator(this.entities);
      const errors = structuralValidator.validate();

      const statsGenerator = new StatisticsGenerator(this.entities);
      const stats = statsGenerator.generate();

      const validationErrors: ValidationError[] = errors.filter(
        (error) => error.severity === 'ERROR',
      );
      const validationWarnings = errors.filter(
        (error) => error.severity === 'WARNING',
      ) as ValidationWarning[];

      return {
        isValid: validationErrors.length === 0,
        errors: validationErrors,
        warnings: validationWarnings,
        stats: stats,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [
          {
            type: 'SYNTAX',
            message: `Failed to parse IFC content: ${error.message}`,
            severity: 'ERROR',
          },
        ],
        warnings: [],
        stats: {
          totalEntities: 0,
          uniqueTypes: 0,
          entityCounts: {},
          referenceCounts: {
            total: 0,
            resolved: 0,
            broken: 0,
          },
        },
      };
    }
  }

  getEntities(): Map<number, IfcEntity> {
    return this.entities;
  }
}

function formatValidationReport(result: ValidationResult): string {
  let report = `Validation Result:\n`;
  report += `Is Valid: ${result.isValid}\n`;
  report += `Total Entities: ${result.stats.totalEntities}\n`;
  report += `Unique Types: ${result.stats.uniqueTypes}\n`;
  report += `Entity Counts: ${JSON.stringify(result.stats.entityCounts, null, 2)}\n`;
  report += `Reference Counts: ${JSON.stringify(result.stats.referenceCounts, null, 2)}\n`;

  if (result.errors.length > 0) {
    report += `\nErrors:\n`;
    result.errors.forEach((error) => {
      report += `- ${error.type} at line ${error.line}: ${error.message}\n`;
    });
  }

  if (result.warnings.length > 0) {
    report += `\nWarnings:\n`;
    result.warnings.forEach((warning) => {
      report += `- ${warning.type} at line ${warning.line}: ${warning.message}\n`;
    });
  }

  return report;
}

export {
  IfcExpressParser,
  IfcStructureValidator,
  StatisticsGenerator,
  IfcValidator,
  formatValidationReport,
};

export type {
  IfcEntity,
  IfcReference,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationStats,
};
