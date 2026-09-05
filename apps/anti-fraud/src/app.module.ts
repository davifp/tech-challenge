import { Module } from '@nestjs/common';

import { antiFraudProviders } from './anti-fraud.providers';
import { ConfigModule } from './infrastructure/config/config.module';

@Module({ imports: [ConfigModule], providers: antiFraudProviders })
export class AppModule {}
