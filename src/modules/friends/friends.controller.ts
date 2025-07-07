import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { FriendsService } from './friends.service';
import {
  addFriendDto,
  blockFriendDto,
  listFriendsDto,
  unblockFriendDto,
} from './friends.dto';
import { User } from '@/common/decorator/user.decorator';
import { UserWithoutPassword } from '@/common/types/db';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  async listFriends(
    @Query() query: listFriendsDto,
    @User() user: UserWithoutPassword,
  ) {
    return this.friendsService.listFriends({ userId: user.id, query });
  }

  @Post()
  async addFriend(
    @Body() body: addFriendDto,
    @User() user: UserWithoutPassword,
  ) {
    return this.friendsService.addFriend({
      userId: user.id,
      friendId: body.friendId,
    });
  }

  @Post('/unfriend')
  async unFriend(
    @Body() body: unblockFriendDto,
    @User() user: UserWithoutPassword,
  ) {
    return this.friendsService.unFriend({
      userId: user.id,
      friendId: body.friendId,
    });
  }

  @Post('/block')
  async blockFriend(
    @Body() body: blockFriendDto,
    @User() user: UserWithoutPassword,
  ) {
    return this.friendsService.blockFriend({
      userId: user.id,
      friendId: body.friendId,
      reason: body.reason,
    });
  }

  @Post('/unblock')
  async unblockFriend(
    @Body() body: unblockFriendDto,
    @User() user: UserWithoutPassword,
  ) {
    return this.friendsService.unblockFriend({
      userId: user.id,
      friendId: body.friendId,
    });
  }
}
