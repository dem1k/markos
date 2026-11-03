import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const origins = (process.env.CORS_ORIGIN || 'http://127.0.0.1:5173,http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
  app.enableCors({ origin: origins, credentials: true })
  const port = Number(process.env.PORT || 3001)
  await app.listen(port)
  console.log(`markOS backend on http://127.0.0.1:${port}`)
}

void bootstrap()
