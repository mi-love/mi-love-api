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
    EXPO_ACCESS_TOKEN: string;
    META_TOKEN_VERIFICATION_KEY: string;
    META_ACCESS_TOKEN: string;
  }
}
