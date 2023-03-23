import { TextEncoder, TextDecoder } from "util";
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

import { Event, validateEvent, verifySignature } from "nostr-tools";
import { buildNote } from "./form_controller";
import {
  fetchEventsWithTimeout,
  publishEventWithTimeout,
} from "./nostr_helpers";

test("publishEventWithTimeout", async () => {
  const noteContent = {
    dTagTarget: { value: "slug" },
    titleTarget: { value: "title" },
    publishedAtTarget: { value: "2023-03-23T13:46:41.000" },
    imageTarget: { value: "https://example.com/image.png" },
    tTagsTarget: { value: "t1, t2, t3" },
    summaryTarget: { value: "summary" },
    contentTarget: { value: "content" },
  };
  const event = buildNote(noteContent) as Event;
  event.pubkey =
    "8071afec6d98299978ef26dc6a87f62b0c0f3eab66047b5dbe46e83c29a6a391";
  event.id = "397c2192b92c8e0be9b606423d394c97078e47366ce30979a2b971168b88abb7";
  event.sig =
    "1cae7d6f869ce00e960cab0e8d54b6dd68a56159dc835eb05bbcbe39faea0b3b2286e7b6966c2de7dc5bb18a0e45252ff889cff3b42ffded91508a2568add82e";

  await expect(
    publishEventWithTimeout("wss://nostr-dev.wellorder.net", event, 10000)
  ).resolves.toEqual(undefined);
});

test("fetchEventsWithTimeout", async () => {
  const filters = [
    {
      authors: [
        "8071afec6d98299978ef26dc6a87f62b0c0f3eab66047b5dbe46e83c29a6a391", // jraedisch_test
        // "b8aafafe72f7cd06ae8c337f93147f65fe2d34c0065b52696123982438cf06fe", // jraedisch
        // "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d", // fiatjaf
      ],
      kinds: [30023],
    },
  ];

  await expect(
    fetchEventsWithTimeout("wss://nostr-dev.wellorder.net", 1, 4000, filters)
  ).rejects.toEqual("relay timed out: wss://nostr-dev.wellorder.net");

  await expect(
    fetchEventsWithTimeout("wss://nostr-dev.wellorder.net", 4000, 1, filters)
  ).resolves.toEqual([]);

  await expect(
    fetchEventsWithTimeout("wss://nostr-dev.wellorder.net", 4000, 4000, filters)
  ).resolves.toEqual([]); // TODO: This should not be empty. - jraedisch
});
