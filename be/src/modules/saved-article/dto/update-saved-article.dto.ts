import { PartialType } from '@nestjs/mapped-types';
import { CreateSavedArticleDto } from './create-saved-article.dto';

export class UpdateSavedArticleDto extends PartialType(CreateSavedArticleDto) {}
