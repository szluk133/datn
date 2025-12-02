import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Public } from '@/decorator/customize';
import { Roles } from '../../auth/role/roles.decorator';
import { Role } from '../../auth/role/roles.enum';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  @Public()
  
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(Role.Admin)
  async findAll(
    @Query() query: string,
    @Query("current") current: string,
    @Query("pageSize") pageSize: string,
  ) {
    return this.usersService.findAll(query, +current, +pageSize);
  }

  @Get(':id')
  
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch()
  
  update(@Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(updateUserDto);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
