const allData = require("../todoapi.gifts.json");
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();


allData.forEach(async (data) => {
    const gift = {
        name: data.name,
        category: data.category,
        imageId: data.imageId,
        coins: data.coins,
    };


    if (!data.category) {
        return console.log(`Skipping gift with no category: ${data.name}`);
    }

    let category;
    const checkCategory = await db.gift_category.findFirst({
        where: {
            name: data.category,
        },
    });


    if (!checkCategory) {
        category = await db.gift_category.create({
            data: {
                name: data.category,
            },
        });
    }
    category = checkCategory;

    const checkGiift = await db.gift.findFirst({
        where: {
            name: data.name,
        },
    });
    if (checkGiift) {
        return console.log(`Gift already exists: ${data.name}`);
    }

    await db.gift.create({
        data: {
            points: data.coins,
            name: data.name,
            image: {
                create: {
                    type: "image",
                    provider: "cloudinary",
                    url: data.imageId,
                }
            },
            category: {
                connect: {
                    id: category.id,
                }
            }
        }
    });
    console.log(`Gift created: ${data.name}`);
});

db.$disconnect()
console.log("Seeding completed.");