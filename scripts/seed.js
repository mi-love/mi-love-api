const allData = require("../todoapi.gifts.json");
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function seedGifts() {
    console.log("Starting gift seeding...");
    let processedCount = 0;
    let skippedCount = 0;
    let createdCount = 0;

    try {
        for (const data of allData) {
            processedCount++;
            
            if (!data.category) {
                console.log(`Skipping gift with no category: ${data.name}`);
                skippedCount++;
                continue;
            }

            // Find or create category
            let category = await db.gift_category.findFirst({
                where: {
                    name: data.category,
                },
            });

            if (!category) {
                category = await db.gift_category.create({
                    data: {
                        name: data.category,
                    },
                });
                console.log(`Created category: ${data.category}`);
            }

            // Check if gift already exists
            const existingGift = await db.gift.findFirst({
                where: {
                    name: data.name,
                },
            });

            if (existingGift) {
                console.log(`Gift already exists: ${data.name}`);
                skippedCount++;
                continue;
            }

            // Create gift with image
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
            createdCount++;
        }

        console.log(`\nSeeding completed successfully!`);
        console.log(`Processed: ${processedCount} gifts`);
        console.log(`Created: ${createdCount} gifts`);
        console.log(`Skipped: ${skippedCount} gifts`);
        
    } catch (error) {
        console.error("Error during seeding:", error);
        throw error;
    } finally {
        await db.$disconnect();
    }
}

// Run the seeding function
seedGifts()
    .then(() => {
        console.log("Seeding process finished.");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Seeding failed:", error);
        process.exit(1);
    });