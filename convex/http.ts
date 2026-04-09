import './helpers/polyfills';
import { httpRouter } from 'convex/server';
import { authClient } from './auth';
import { createAuth } from './auth';

const http = httpRouter();

authClient.registerRoutes(http, createAuth);

export default http;
