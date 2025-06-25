declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production';
    BASE_URL: string;
    EXPO_SCHEME: string;
    DATABASE_URL: string;
  }
}
