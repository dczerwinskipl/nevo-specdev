import type { RuntimeAuthenticationConfig, RuntimeAuthorizationConfig } from '../features/auth';
import type { SpecsFeatureConfig } from '../features/specs';
import type { EndpointRateLimit } from '../server/endpoint-policy-config';

export interface RuntimeServerTlsConfig {
  readonly enabled: boolean;
  readonly certFile?: string;
  readonly keyFile?: string;
}

export interface RuntimeServerConfig {
  readonly rateLimit?: EndpointRateLimit;
  readonly host: string;
  readonly port: number;
  readonly publicOrigin?: string;
  readonly tls: RuntimeServerTlsConfig;
}

export interface RuntimeConfig {
  readonly server: RuntimeServerConfig;
  readonly authentication: RuntimeAuthenticationConfig;
  readonly authorization?: RuntimeAuthorizationConfig;
  readonly specs?: SpecsFeatureConfig;
}

export interface LoadedRuntimeConfig {
  readonly config: RuntimeConfig;
  readonly sources: {
    readonly project: string;
    readonly local?: string;
  };
}
