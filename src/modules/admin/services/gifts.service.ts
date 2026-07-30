import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../../../database/database.service';
import { LoggerService } from '../../../common/services/logger.service';
import {
  CreateGiftCategoryDto,
  CreateGiftDto,
  ListGiftsQueryDto,
  UpdateGiftCategoryDto,
  UpdateGiftDto,
} from '../dtos/content-gifts.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminGiftsService {
  constructor(
    private db: DbService,
    private logger: LoggerService,
  ) {}

  async listCategories(adminId: string) {
    const categories = await this.db.gift_category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { gift: true } },
      },
    });
    this.logger.logAdminAction(adminId, 'LIST_GIFT_CATEGORIES', 'gift_category');
    return { data: categories };
  }

  async createCategory(data: CreateGiftCategoryDto, adminId: string) {
    try {
      const category = await this.db.gift_category.create({
        data: {
          name: data.name.trim(),
          description: data.description,
        },
      });
      await this.db.admin_action_log.create({
        data: {
          adminId,
          action: 'CREATE_GIFT_CATEGORY',
          resource: 'gift_category',
          resource_id: category.id,
          metadata: data as any,
        },
      });
      return { message: 'Category created', data: category };
    } catch {
      throw new ConflictException({ message: 'Category name already exists' });
    }
  }

  async updateCategory(
    id: string,
    data: UpdateGiftCategoryDto,
    adminId: string,
  ) {
    const existing = await this.db.gift_category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ message: 'Category not found' });
    }
    const category = await this.db.gift_category.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        description: data.description,
      },
    });
    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'UPDATE_GIFT_CATEGORY',
        resource: 'gift_category',
        resource_id: id,
        metadata: data as any,
      },
    });
    return { message: 'Category updated', data: category };
  }

  async deleteCategory(id: string, adminId: string) {
    const existing = await this.db.gift_category.findUnique({
      where: { id },
      include: { _count: { select: { gift: true } } },
    });
    if (!existing) {
      throw new NotFoundException({ message: 'Category not found' });
    }
    if (existing._count.gift > 0) {
      throw new ConflictException({
        message: 'Cannot delete category with gifts. Move or delete gifts first.',
      });
    }
    await this.db.gift_category.delete({ where: { id } });
    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'DELETE_GIFT_CATEGORY',
        resource: 'gift_category',
        resource_id: id,
      },
    });
    return { message: 'Category deleted' };
  }

  async listGifts(query: ListGiftsQueryDto, adminId: string) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const where: Prisma.giftWhereInput = {};
    if (query.categoryId) where.gift_category_id = query.categoryId;
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [gifts, total] = await Promise.all([
      this.db.gift.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          category: { select: { id: true, name: true } },
          image: { select: { id: true, url: true } },
        },
      }),
      this.db.gift.count({ where }),
    ]);

    return {
      data: gifts.map((g) => ({
        ...g,
        points: Number(g.points),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async createGift(data: CreateGiftDto, adminId: string) {
    const category = await this.db.gift_category.findUnique({
      where: { id: data.gift_category_id },
    });
    if (!category) {
      throw new NotFoundException({ message: 'Category not found' });
    }

    const gift = await this.db.gift.create({
      data: {
        name: data.name,
        description: data.description,
        points: data.points,
        gift_category_id: data.gift_category_id,
        imageId: data.imageId,
      },
      include: {
        category: { select: { id: true, name: true } },
        image: { select: { id: true, url: true } },
      },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'CREATE_GIFT',
        resource: 'gift',
        resource_id: gift.id,
        metadata: data as any,
      },
    });

    return {
      message: 'Gift created',
      data: { ...gift, points: Number(gift.points) },
    };
  }

  async updateGift(id: string, data: UpdateGiftDto, adminId: string) {
    const existing = await this.db.gift.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ message: 'Gift not found' });
    }

    if (data.gift_category_id) {
      const category = await this.db.gift_category.findUnique({
        where: { id: data.gift_category_id },
      });
      if (!category) {
        throw new NotFoundException({ message: 'Category not found' });
      }
    }

    const gift = await this.db.gift.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        points: data.points,
        gift_category_id: data.gift_category_id,
        imageId: data.imageId,
      },
      include: {
        category: { select: { id: true, name: true } },
        image: { select: { id: true, url: true } },
      },
    });

    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'UPDATE_GIFT',
        resource: 'gift',
        resource_id: id,
        metadata: data as any,
      },
    });

    return {
      message: 'Gift updated',
      data: { ...gift, points: Number(gift.points) },
    };
  }

  async deleteGift(id: string, adminId: string) {
    const existing = await this.db.gift.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ message: 'Gift not found' });
    }
    await this.db.gift.delete({ where: { id } });
    await this.db.admin_action_log.create({
      data: {
        adminId,
        action: 'DELETE_GIFT',
        resource: 'gift',
        resource_id: id,
      },
    });
    return { message: 'Gift deleted' };
  }
}
