import { IsNotEmpty } from "class-validator";

export class ChangePasswordUserDto {
    @IsNotEmpty({ message: "Mật khẩu hiện tại không được để trống" })
    currentPassword: string;

    @IsNotEmpty({ message: "Mật khẩu mới không được để trống" })
    newPassword: string;

    @IsNotEmpty({ message: "Xác nhận mật khẩu mới không được để trống" })
    confirmPassword: string;
}