import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class ExportSelectedDto {
    @IsArray()
    @IsString({ each: true })
    @IsNotEmpty()
    articleIds: string[];
}