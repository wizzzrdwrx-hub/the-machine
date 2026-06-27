import { LiveViewProcessor } from './LiveViewProcessor';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (url.pathname.startsWith('/live-view/')) {
      const id = env.LIVE_VIEW.idFromName(url.pathname);
      const stub = env.LIVE_VIEW.get(id);
      return stub.fetch(request);
    }
    
    return new Response('THE MACHINE Backend');
  }
};

export { LiveViewProcessor };
