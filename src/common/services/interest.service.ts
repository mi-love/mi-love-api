import { DbService } from '@/database/database.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class InterestService {
  constructor(private db: DbService) {}
  async addAndUpdateInterests(i: string[], { userId }: { userId: string }) {
    const interests = i.map((interest) =>
      interest.toLowerCase().replace(/\s+/g, ''),
    );

    const existingInterests = await this.db.interest.findMany({
      where: { name: { in: interests } },
    });

    const newInterests = interests.filter(
      (interest) => !existingInterests.some((i) => i.name === interest),
    );

    const createdInterests: Prisma.interestCreateInput[] = [];

    for (const interest of newInterests) {
      const createdInterest = await this.db.interest.create({
        data: {
          name: interest,
          user: userId ? { connect: { id: userId } } : undefined,
        },
      });
      createdInterests.push(createdInterest);
    }

    if (userId) {
      for (const interest of existingInterests) {
        await this.db.interest.update({
          where: { id: interest.id },
          data: {
            user: { connect: { id: userId } },
          },
        });
      }
    }

    return {
      createdInterests,
      existingInterests,
    };
  }
}
