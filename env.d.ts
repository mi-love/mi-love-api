declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production';
    BASE_URL: string;
    EXPO_SCHEME: string;
    DATABASE_URL: string;
    JWT_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    ONE_TIME_JWT_SECRET: string;
    PLUNK_API_KEY: string;
    FLU_PUBLIC_KEY: string;
    FLU_SECRET_KEY: string;
    FLU_ENCRYPTION_KEY: string;
    FLU_EMAIL: string;
    PAYSTACK_SECRET_KEY: string;
    PAYSTACK_PUBLIC_KEY: string;
    PAYSTACK_EMAIL: string;
    EXPO_ACCESS_TOKEN: string;
    META_TOKEN_VERIFICATION_KEY: string;
    META_ACCESS_TOKEN: string;
    REDIS_HOST?: string;
    REDIS_PORT?: string;
    REDIS_PASSWORD?: string;
    CLOUDINARY_CLOUD_NAME?: string;
    CLOUDINARY_API_KEY?: string;
    CLOUDINARY_API_SECRET?: string;
  }
}
