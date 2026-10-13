import { Type } from 'class-transformer';
import { IsNumber, IsObject, ValidateNested } from 'class-validator';
import { IsInt, Max, Min } from 'class-validator';

class EvalConfigDto {
  @IsInt() @Min(1) @Max(50)
  topK: number;

  @IsInt() @Min(1) @Max(50)
  keywordTopK: number;

  @IsNumber() @Min(0) @Max(1)
  minScore: number;

  @IsInt() @Min(1) @Max(30)
  rerankTopN: number;
}

export class EvalCompareDto {
  @IsObject()
  @ValidateNested()
  @Type(() => EvalConfigDto)
  a: EvalConfigDto;

  @IsObject()
  @ValidateNested()
  @Type(() => EvalConfigDto)
  b: EvalConfigDto;
}
