import { Resolver } from '@stoplight/json-ref-resolver';
import { createResolveHttp, resolveFile } from '@stoplight/ref-resolvers';
import { DEFAULT_REQUEST_OPTIONS } from '../request';

const resolveHttp = createResolveHttp(DEFAULT_REQUEST_OPTIONS);

// resolves files, http and https $refs, and internal $refs
export const httpAndFileResolver = new Resolver({
  resolvers: {
    https: { resolve: resolveHttp },
    http: { resolve: resolveHttp },
    file: { resolve: resolveFile },
  },
});
