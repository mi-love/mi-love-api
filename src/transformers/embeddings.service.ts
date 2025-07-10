import { pipeline } from '@xenova/transformers';
import { Injectable } from '@nestjs/common';
import path from 'path';

@Injectable()
export class EmbeddingsService {
  constructor() {}

  async extractionTest() {
    const now = performance.now();
    const extractor = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
    );
    const str = `Chasing dreams takes courage, consistency, and a little bit of chaos. Remember why you started, even on the days it feels hard. 🌟 #MotivationMonday #KeepGoing”
Just deployed a full-stack app using NestJS, PostgreSQL, and BullMQ. Background tasks never felt so smooth! 🚀 #DevLife #NodeJS #Microservices”

✍️ Sample Post Text 3 (Food / Casual)
“Can we talk about how underrated mango smoothies are? Just had one with lime and ginger and I swear I saw heaven. 🥭🍹 #Foodie #TropicalVibes”

✍️ Sample Post Text 4 (Humor / Relatable)
“I open my laptop to work and somehow end up deep into 2009 Facebook photos. Productivity: -17%. 🤦‍♂️ #JustMeThings”

Would you like me to generate a few more in a specific category like:

Fashion

Fitness

Christianity

Finance

Real estate

Relationships

Memes
`;
    const output = await extractor(str, { pooling: 'mean' });
    const after = performance.now();
    console.log(output.data);
    console.log(
      `Time taken: ${after - now} milliseconds for ${str.length} tokens`,
    );
  }

  async textGenerationTest() {
    const generator = await pipeline(
      'text-generation',
      'onnx-community/Qwen2.5-Coder-0.5B-Instruct',
    );
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Write a quick sort algorithm.' },
    ];
    const result = await generator(messages, {
      max_new_tokens: 512,
      do_sample: false,
    });

    console.log(result);
  }

  async fromImage() {
    const extractor = await pipeline(
      'feature-extraction',
      'Xenova/clip-vit-base-patch32',
    );

    const absolutePath = path.join(
      process.cwd(),
      'uploads',
      'files-1751911129178.png',
    );
    const fileUrl = `file://${absolutePath}`;
    console.log(fileUrl);
    // Provide image path or blob
    const result = await extractor(fileUrl, {
      pooling: 'mean',
    });

    console.log(result.data);
  }
}
