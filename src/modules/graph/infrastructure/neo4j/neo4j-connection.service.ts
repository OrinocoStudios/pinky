import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Driver, Session, auth, driver as neo4jDriver } from 'neo4j-driver';
import { BrainConfig } from '../../../../config/configuration';

@Injectable()
export class Neo4jConnectionService implements OnModuleDestroy {
  private readonly driver: Driver;

  constructor(private readonly configService: ConfigService<BrainConfig>) {
    const uri = this.configService.get<string>('neo4j.uri', { infer: true });
    const user = this.configService.get<string>('neo4j.user', { infer: true });
    const password = this.configService.get<string>('neo4j.password', { infer: true });

    if (!uri || !user || !password) {
      throw new Error('Neo4j config is missing');
    }

    this.driver = neo4jDriver(uri, auth.basic(user, password));
  }

  getSession(): Session {
    return this.driver.session();
  }

  async ping(): Promise<void> {
    const session = this.getSession();
    try {
      await session.run('RETURN 1');
    } finally {
      await session.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.driver.close();
  }
}
