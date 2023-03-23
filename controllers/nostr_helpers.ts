import { Event, Filter, Relay, relayInit } from "nostr-tools";

export const fetchEventsWithTimeout = (
  relayURL: string,
  connectTimeout: number,
  subscribeTimeout: number,
  filters: Filter[]
): Promise<Event[]> =>
  connectedRelay(relayURL, connectTimeout).then((relay) => {
    const sub = relay.sub(filters);
    const events: Event[] = [];
    sub.on("event", (event: Event) => {
      console.debug(event);
      events.push(event);
    });

    let finish;
    const done = new Promise((resolve) => {
      finish = resolve;
    });
    const wrapUp = () => {
      sub.unsub();
      relay.close();
      finish();
    };
    sub.on("eose", wrapUp);

    return Promise.race([done, timeoutPromise(subscribeTimeout)]).then(
      (result) => {
        if (result === TIMEDOUT) {
          console.debug("subscription timed out");
          wrapUp;
        }
        return events;
      }
    );
  });

export const publishEventWithTimeout = async (
  relayURL: string,
  event: Event,
  connectTimeout: number
) =>
  connectedRelay(relayURL, connectTimeout).then((relay) => {
    const pub = relay.publish(event);

    let finish;
    const done = new Promise((resolve) => {
      finish = resolve;
    });
    pub.on("ok", () => {
      console.log(`${relay.url} has accepted our event`);
      finish();
    });
    pub.on("failed", (reason) => {
      throw `failed to publish to ${relay.url}: ${reason}`;
    });

    done.then(relay.close);
  });

export const uniqueEvents = (events: Event[] | Event[][]): Event[] => {
  const h: Map<string, Event> = new Map();
  events.flat().forEach((ev) => h.set(ev.id, ev));
  return Array.from(h.values());
};

export const newestEvent = (events: Event[] | Event[][]): Event | null => {
  events = events.flat();
  let event = events[0];
  events.forEach((ev) => {
    if (ev.created_at > event.created_at) event = ev;
  });
  return event;
};

const connectedRelay = async (
  relayURL: string,
  connectTimeout: number
): Promise<Relay> => {
  const relay = relayInit(relayURL);
  relay.on("connect", () => {
    console.debug(`relay connected: ${relayURL}`);
  });
  relay.on("error", () => {
    throw `error connecting to relay: ${relayURL}`;
  });
  const reason = await Promise.race([
    relay.connect(),
    timeoutPromise(connectTimeout),
  ]);
  if (reason == TIMEDOUT) {
    relay.close();
    console.debug("relay connection timed out");

    throw `relay timed out: ${relayURL}`;
  }
  return relay;
};

const TIMEDOUT = "timedout";

const timeoutPromise = (ms: number): Promise<string> =>
  new Promise<string>((resolve) =>
    setTimeout(() => {
      resolve(TIMEDOUT);
    }, ms)
  );
