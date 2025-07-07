import { IsNotEmpty, IsString } from 'class-validator';

export class blockFriendDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsNotEmpty()
  friendId: string;
}

export class unblockFriendDto {
  @IsString()
  @IsNotEmpty()
  friendId: string;
}

export class listFriendsDto {
  filterValue: string;

  filterBy: 'blocked' | 'friends' | 'explore';

  limit: number;
  page: number;

  order: 'desc' | 'asc';
}

export class addFriendDto {
  @IsString()
  @IsNotEmpty()
  friendId: string;
}
