import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { Model, mongo } from 'mongoose';
import { hashPasswordHelper } from '@/helpers/util';
import aqp from 'api-query-params';
import mongoose from 'mongoose';
import { ChangePasswordAuthDto, CodeAuthDto, CreateAuthDto } from '@/auth/dto/create-auth.dto';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { MailerService } from '@nestjs-modules/mailer';
import { ChangePasswordUserDto } from './dto/change-password-user.dto';
import { compareSync } from 'bcrypt';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {

  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,

    private readonly mailerService: MailerService
  ) { }

  isEmailExist = async (email: string) => {
    const user = await this.userModel.exists({ email });
    if (user) return true;
    return false;
  }

  async create(createUserDto: CreateUserDto) {
    const { name, email, password, phone, address, image } = createUserDto;

    //check email
    const isExist = await this.isEmailExist(email);
    if (isExist === true) {
      throw new BadRequestException(`Email đã tồn tại: ${email}. Vui lòng sử dụng email khác.`)
    }

    //hash password
    const hashPassword = await hashPasswordHelper(password);
    const user = await this.userModel.create({
      name, email, password: hashPassword, phone, address, image
    })
    return {
      _id: user._id
    }
  }

  async findAll(query: string, current: number, pageSize: number) {
    const { filter, sort } = aqp(query);
    if (filter.current) delete filter.current;
    if (filter.pageSize) delete filter.pageSize;

    if (!current) current = 1;
    if (!pageSize) pageSize = 10;

    const totalItems = (await this.userModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / pageSize);

    const skip = (current - 1) * (pageSize);

    const results = await this.userModel
      .find(filter)
      .limit(pageSize)
      .skip(skip)
      .select("-password")
      .sort(sort as any);

    return {
      meta: {
        current: current,
        pageSize: pageSize,
        pages: totalPages,
        total: totalItems
      },
      results
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  async findByEmail(email: string) {
    return await this.userModel.findOne({ email })
  }

  async update(updateUserDto: UpdateUserDto) {
    return await this.userModel.updateOne(
      { _id: updateUserDto._id }, { ...updateUserDto });
  }

  async remove(_id: string) {
    //check id
    if (mongoose.isValidObjectId(_id)) {
      //delete
      return this.userModel.deleteOne({ _id })
    } else {
      throw new BadRequestException("Id không đúng định dạng mongodb")
    }

  }

  async handleRegister(registerDto: CreateAuthDto) {
    const { name, email, password } = registerDto;

    //check email
    const isExist = await this.isEmailExist(email);
    if (isExist === true) {
      throw new BadRequestException(`Email đã tồn tại: ${email}. Vui lòng sử dụng email khác.`)
    }

    //hash password
    const hashPassword = await hashPasswordHelper(password);
    const codeId = uuidv4();
    const user = await this.userModel.create({
      name, email, password: hashPassword,
      isActive: false,
      codeId: codeId,
      codeExpired: dayjs().add(5, 'minutes')
      // codeExpired: dayjs().add(30, 'seconds')
    })

    //send email
    this.mailerService.sendMail({
      to: user.email, // list of receivers
      subject: 'Activate your account at @lvc', // Subject line
      template: "register",
      context: {
        name: user?.name ?? user.email,
        activationCode: codeId
      }
    })
    //trả ra phản hồi
    return {
      _id: user._id
    }

  }

  async handleActive(data: CodeAuthDto) {
    const user = await this.userModel.findOne({
      _id: data._id,
      codeId: data.code
    })
    if (!user) {
      throw new BadRequestException("Mã code không hợp lệ hoặc đã hết hạn")
    }

    //check expire code
    const isBeforeCheck = dayjs().isBefore(user.codeExpired);

    if (isBeforeCheck) {
      //valid => update user
      await this.userModel.updateOne({ _id: data._id }, {
        isActive: true
      })
      return { isBeforeCheck };
    } else {
      throw new BadRequestException("Mã code không hợp lệ hoặc đã hết hạn")
    }


  }

  async retryActive(email: string) {
    //check email
    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new BadRequestException("Tài khoản không tồn tại")
    }
    if (user.isActive) {
      throw new BadRequestException("Tài khoản đã được kích hoạt")
    }

    //send Email
    const codeId = uuidv4();

    //update user
    await user.updateOne({
      codeId: codeId,
      codeExpired: dayjs().add(5, 'minutes')
    })

    //send email
    this.mailerService.sendMail({
      to: user.email, // list of receivers
      subject: 'Activate your account at @lvc', // Subject line
      template: "register",
      context: {
        name: user?.name ?? user.email,
        activationCode: codeId
      }
    })
    return { _id: user._id }
  }

  async retryPassword(email: string) {
    //check email
    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new BadRequestException("Tài khoản không tồn tại")
    }


    //send Email
    const codeId = uuidv4();

    //update user
    await user.updateOne({
      codeId: codeId,
      codeExpired: dayjs().add(5, 'minutes')
    })

    //send email
    this.mailerService.sendMail({
      to: user.email, // list of receivers
      subject: 'Change your password account at @lvc', // Subject line
      template: "register",
      context: {
        name: user?.name ?? user.email,
        activationCode: codeId
      }
    })
    return { _id: user._id, email: user.email }
  }

  async changePassword(data: ChangePasswordAuthDto) {
    if (data.confirmPassword !== data.password) {
      throw new BadRequestException("Mật khẩu/xác nhận mật khẩu không chính xác.")
    }

    //check email
    const user = await this.userModel.findOne({ email: data.email });

    if (!user) {
      throw new BadRequestException("Tài khoản không tồn tại")
    }

    //check expire code
    const isBeforeCheck = dayjs().isBefore(user.codeExpired);

    if (isBeforeCheck) {
      //valid => update password
      const newPassword = await hashPasswordHelper(data.password);
      await user.updateOne({ password: newPassword })
      return { isBeforeCheck };
    } else {
      throw new BadRequestException("Mã code không hợp lệ hoặc đã hết hạn")
    }

  }

  async changeUserPassword(data: ChangePasswordUserDto, user: any) {
    const { currentPassword, newPassword, confirmPassword } = data;

    if (newPassword !== confirmPassword) {
      throw new BadRequestException("Mật khẩu mới và xác nhận mật khẩu không khớp");
    }

    const foundUser = await this.userModel.findOne({ _id: user._id });
    if (!foundUser) {
      throw new BadRequestException("Người dùng không tồn tại");
    }

    const isValid = compareSync(currentPassword, foundUser.password);
    if (!isValid) {
      throw new BadRequestException("Mật khẩu hiện tại không chính xác");
    }

    const hashPassword = await hashPasswordHelper(newPassword);
    await this.userModel.updateOne({ _id: user._id }, { password: hashPassword });

    return { status: "success", message: "Đổi mật khẩu thành công" };
  }

  async updateProfile(data: UpdateProfileDto, user: any) {
    return await this.userModel.updateOne({ _id: user._id }, { ...data });
  }

  async findProfile(user: any) {
    const result = await this.userModel.findOne({ _id: user._id }).select('-password -codeId -codeExpired');
    return result;
  }

}