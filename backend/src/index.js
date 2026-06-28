import { LiveViewProcessor } from './LiveViewProcessor';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (url.pathname.startsWith('/live-view/')) {
      // Extract the feedId segment so both /init and the WebSocket upgrade
      // resolve to the SAME Durable Object instance.
      const feedId = url.pathname.split('/')[2];
      const id = env.LIVE_VIEW.idFromName(feedId);
      const stub = env.LIVE_VIEW.get(id);
      return stub.fetch(request);
    }
    
    return new Response('THE MACHINE Backend');
  }
};

export { LiveViewProcessor };
