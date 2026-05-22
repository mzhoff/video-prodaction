import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

@Module({})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
