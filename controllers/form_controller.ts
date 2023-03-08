import { Controller } from "@hotwired/stimulus";
import {
  relayInit,
  Kind,
  Relay,
  Event as NostrEvent,
  EventTemplate,
} from "nostr-tools";
import {
  fromDatetimeLocal,
  toDatetimeLocalStep1,
  toUnixTimestamp,
} from "./time_helpers";

const client = "longpub";

const notesCache: { [dTag: string]: NostrEvent } = {};

// Connects to data-controller="form"
export default class extends Controller {
  static values = {};
  static targets = [
    "dTags",
    "relay",
    "dTag",
    "title",
    "publishedAt",
    "image",
    "tTags",
    "summary",
    "content",
  ];

  dTagsTarget: HTMLDataListElement;
  relayTarget: HTMLInputElement;
  dTagTarget: HTMLInputElement;
  titleTarget: HTMLInputElement;
  publishedAtTarget: HTMLInputElement;
  imageTarget: HTMLInputElement;
  tTagsTarget: HTMLInputElement;
  summaryTarget: HTMLTextAreaElement;
  contentTarget: HTMLTextAreaElement;

  connect() {}

  cacheNotes(e: Event) {
    e.preventDefault();
    getNostrPromise()
      .then((nos: Nostr) => nos.getPublicKey())
      .then((pubkey) => fetchNotes(pubkey, this.relayTarget.value))
      .then((events: NostrEvent[]) => {
        toOptions(events, this.dTagsTarget);
        this.dTagTarget.placeholder = "Select or input new.";
      })
      .catch((err) => window.alert(err));
  }

  loadNote() {
    const note = notesCache[this.dTagTarget.value];
    if (!note) return;

    this.titleTarget.value = tagValue(note, "title");
    this.publishedAtTarget.value = toDatetimeLocalStep1(
      tagValue(note, "published_at")
    );
    this.imageTarget.value = tagValue(note, "image");
    this.tTagsTarget.value = tagValues(note, "t").join(", ");
    this.summaryTarget.value = tagValue(note, "summary");
    this.contentTarget.value = note.content;
  }

  publishNote(e: Event) {
    e.preventDefault();
    getNostrPromise()
      .then((nos) => nos.signEvent(buildNote(this)))
      .then((note: NostrEvent) => sendNote(this.relayTarget.value, note))
      .then(() => {
        if (window.confirm("Note sent successfully! Reset form?")) {
          window.location.reload();
        }
      })
      .catch((err) => window.alert(err));
  }
}

const tagValues = (note: NostrEvent, key: string): string[] => {
  const values = note.tags.find(([k]) => k == key);
  if (values) return values.slice(1);
  return [];
};

const tagValue = (note: NostrEvent, key: string): string => {
  const values = tagValues(note, key);
  if (values.length > 0) {
    return values[0];
  }
  return "";
};

interface NoteInputs {
  dTagTarget: HTMLInputElement;
  titleTarget: HTMLInputElement;
  publishedAtTarget: HTMLInputElement;
  imageTarget: HTMLInputElement;
  tTagsTarget: HTMLInputElement;
  summaryTarget: HTMLTextAreaElement;
  contentTarget: HTMLTextAreaElement;
}

const buildNote = (inputs: NoteInputs): EventTemplate => {
  const dTag = inputs.dTagTarget.value.trim();
  const title = inputs.titleTarget.value.trim();
  const publishedAt = inputs.publishedAtTarget.value.trim();
  const image = inputs.imageTarget.value.trim();
  const tTags = inputs.tTagsTarget.value
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t != "");
  const summary = inputs.summaryTarget.value.trim();
  const content = inputs.contentTarget.value.trim();

  const tags: string[][] = [];
  if (dTag != "") tags.push(["d", dTag]);
  if (title != "") tags.push(["title", title]);
  if (image != "") tags.push(["image", image]);
  if (tTags.length > 0) tags.push(["t", ...tTags]);
  if (publishedAt != "")
    tags.push(["published_at", fromDatetimeLocal(publishedAt).toString()]);
  if (summary != "") tags.push(["summary", summary]);
  tags.push(["client", client]);

  const note = {
    kind: Kind.Article,
    content: content,
    tags: tags,
    created_at: toUnixTimestamp(Date.now()),
  };

  return note;
};

const toOptions = (notes: NostrEvent[], list: HTMLDataListElement) => {
  notes.map((note) => {
    const dTag = note.tags.find(([k]) => k == "d");
    if (dTag && dTag.length >= 2) {
      notesCache[dTag[1]] = note;
      addOption(list, dTag[1]);
    }
  });
};

const addOption = (list: HTMLDataListElement, dTag: string) => {
  const option = document.createElement("option");
  option.value = dTag;
  list.appendChild(option);
};

const relayConnect = async (relayURL: string): Promise<Relay> => {
  const relay = relayInit(relayURL);
  relay.on("connect", () => {
    console.log(`connected to ${relay.url}`);
  });
  relay.on("error", () => {
    throw `failed to connect to ${relay.url}`;
  });
  await relay.connect();
  return relay;
};

const sendNote = async (relayURL: string, note: NostrEvent) => {
  const relay = await relayConnect(relayURL);

  const pub = relay.publish(note);

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

  await done;
  relay.close();
};

const fetchNotes = async (
  pubkey: string,
  relayURL: string
): Promise<NostrEvent[]> => {
  const relay = await relayConnect(relayURL);

  let sub = relay.sub([
    {
      authors: [pubkey],
      kinds: [Kind.Article],
    },
  ]);
  const notes: NostrEvent[] = [];
  sub.on("event", (note: NostrEvent) => {
    notes.push(note);
  });

  let finish;
  const done = new Promise((resolve) => {
    finish = resolve;
  });
  sub.on("eose", () => {
    sub.unsub();
    relay.close();
    finish();
  });

  await done;
  return notes;
};

interface Nostr {
  getPublicKey(): Promise<string>;
  signEvent(event: EventTemplate): Promise<NostrEvent>;
}

const getNostrPromise = (): Promise<Nostr> => {
  return new Promise(getNostr);
};

const getNostr = (): Nostr => {
  if (typeof window === "undefined") {
    throw "missing window object";
  }
  if (typeof window["nostr"] === "undefined") {
    throw "Missing Nostr plugin, please install! (E.g. https://getalby.com.)";
  }

  return window["nostr"];
};
