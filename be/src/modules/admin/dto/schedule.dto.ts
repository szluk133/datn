import { IsInt, Min, IsNotEmpty } from 'class-validator';

export class ScheduleDto {
    @IsInt({ message: 'Số phút phải là số nguyên' })
    @Min(5, { message: 'Thời gian lặp lại tối thiểu là 5 phút' })
    @IsNotEmpty()
    minutes: number;
}