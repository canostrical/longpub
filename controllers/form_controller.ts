import { Controller } from "@hotwired/stimulus";
import { Kind, Event as NostrEvent, EventTemplate } from "nostr-tools";
import {
  fetchEventsWithTimeout,
  newestEvent,
  publishEventWithTimeout,
  uniqueEvents,
} from "./nostr_helpers";
import {
  fromDatetimeLocal,
  toDatetimeLocalStep1,
  toUnixTimestamp,
} from "./time_helpers";

const client = "longpub";

const notesCache: { [dTag: string]: NostrEvent } = {};

const timeout = 4000;

// Connects to data-controller="form"
export default class extends Controller {
  static values = {};
  static targets = [
    "dTags",
    "relays",
    "dTag",
    "title",
    "publishedAt",
    "image",
    "tTags",
    "summary",
    "content",
    "metaGroup",
    "actionGroup",
  ];

  dTagsTarget: HTMLDataListElement;
  relaysTarget: HTMLTextAreaElement;
  dTagTarget: HTMLInputElement;
  titleTarget: HTMLInputElement;
  publishedAtTarget: HTMLInputElement;
  imageTarget: HTMLInputElement;
  tTagsTarget: HTMLInputElement;
  summaryTarget: HTMLTextAreaElement;
  contentTarget: HTMLTextAreaElement;
  metaGroupTarget: HTMLFieldSetElement;
  actionGroupTarget: HTMLFieldSetElement;

  connect() {
    this.loadContent();
  }

  readRelays(): string[] {
    const urls: string[] = this.relaysTarget.value
      .split("\n")
      .filter((str) => str.trim() !== "")
      .map((str) => (str.includes("://") ? str : `wss://${str}`));

    if (urls.length === 0) urls.push("wss://nostr-pub.wellorder.net");
    return urls;
  }

  fetchRelays(e: Event) {
    e.preventDefault();
    this.relaysTarget.value = "";
    this.relaysTarget.placeholder = "Loading…";
    getNostrPromise()
      .then((nos: Nostr) => nos.getPublicKey())
      .then((pubkey) => fetchRelaysAny(pubkey, this.readRelays()))
      .then((event: NostrEvent | null) => {
        if (!event) {
          this.relaysTarget.placeholder =
            "No relays found. Add at least one of your own, and try again!";
          return;
        }

        this.relaysTarget.value = firstValuePerMatchingTag(event, "r").join(
          "\n"
        );
      })
      .catch((err) => {
        window.alert(err);
        this.relaysTarget.placeholder = "No relays due to error. Add your own!";
      });
  }

  cacheNotes(e: Event) {
    e.preventDefault();
    this.dTagTarget.placeholder = "Loading…";
    getNostrPromise()
      .then((nos: Nostr) => nos.getPublicKey())
      .then((pubkey) => fetchNotesAll(pubkey, this.readRelays()))
      .then((events: NostrEvent[]) => {
        if (events.length == 0) {
          this.dTagTarget.placeholder = "No notes found. Be creative!";
          return;
        }
        toOptions(events, this.dTagsTarget);
        this.dTagTarget.placeholder = "Select or input new.";
      })
      .catch((err) => {
        window.alert(err);
        this.dTagTarget.placeholder = "No notes due to error. Be creative!";
      });
  }

  loadNote() {
    const note = notesCache[this.dTagTarget.value];
    if (!note) return;

    this.titleTarget.value = firstValueOfFirstMatchingTag(note, "title");
    const publishedAt = firstValueOfFirstMatchingTag(note, "published_at");
    if (publishedAt !== "") {
      this.publishedAtTarget.value = toDatetimeLocalStep1(publishedAt);
    }
    this.imageTarget.value = firstValueOfFirstMatchingTag(note, "image");
    this.tTagsTarget.value = firstValuePerMatchingTag(note, "t").join(", ");
    this.summaryTarget.value = firstValueOfFirstMatchingTag(note, "summary");
    this.contentTarget.value = note.content;
  }

  publishNote(e: Event) {
    e.preventDefault();
    getNostrPromise()
      .then((nos) => nos.signEvent(buildNote(this)))
      .then((note: NostrEvent) => sendNoteAll(this.readRelays(), note))
      .then(() => {
        if (window.confirm("Note sent successfully! Reset form?")) {
          window.location.reload();
          localStorage.clear();
        }
      })
      .catch((err) => window.alert(err));
  }

  storeContent() {
    localStorage.setItem("content", this.contentTarget.value);
  }

  loadContent() {
    this.contentTarget.value = localStorage.getItem("content");
  }

  clearStorage() {
    if (window.confirm("Reset form and lose unsaved data?")) {
      localStorage.clear();
    }
  }

  focus() {
    this.metaGroupTarget.classList.toggle("hidden");
    this.actionGroupTarget.classList.toggle("hidden");
    this.contentTarget.classList.toggle("h-96");
    this.contentTarget.classList.toggle("w-11/12");
    this.contentTarget.classList.toggle("lg:w-2/3");
  }
}

const firstValuePerMatchingTag = (note: NostrEvent, key: string): string[] => {
  return note.tags.filter(([k]) => k == key).map(([k, v]) => v);
};

const allValuesOfFirstMatchingTag = (
  note: NostrEvent,
  key: string
): string[] => {
  const values = note.tags.find(([k]) => k == key);
  if (values) return values.slice(1);
  return [];
};

const firstValueOfFirstMatchingTag = (
  note: NostrEvent,
  key: string
): string => {
  const values = allValuesOfFirstMatchingTag(note, key);
  if (values.length > 0) {
    return values[0];
  }
  return "";
};

interface Valuable {
  value: string;
}

interface NoteInputs {
  dTagTarget: Valuable;
  titleTarget: Valuable;
  publishedAtTarget: Valuable;
  imageTarget: Valuable;
  tTagsTarget: Valuable;
  summaryTarget: Valuable;
  contentTarget: Valuable;
}

export const buildNote = (inputs: NoteInputs): EventTemplate => {
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
  if (tTags.length > 0) tTags.forEach((tTag) => tags.push(["t", tTag]));
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

const sendNoteAll = async (relayURLs: string[], note: NostrEvent) =>
  await Promise.all(
    relayURLs.map((url) => publishEventWithTimeout(url, note, timeout))
  );

const fetchRelaysAny = async (
  pubkey: string,
  relayURLs: string[]
): Promise<NostrEvent | null> => {
  const filters = [
    {
      authors: [pubkey],
      kinds: [Kind.RelayList],
    },
  ];
  const events = await Promise.any(
    relayURLs.map((url) =>
      fetchEventsWithTimeout(url, timeout, timeout, filters)
    )
  );
  return newestEvent(events);
};

const fetchNotesAll = async (
  pubkey: string,
  relayURLs: string[]
): Promise<NostrEvent[]> => {
  const filters = [
    {
      authors: [pubkey],
      kinds: [Kind.Article],
    },
  ];
  const notes = await Promise.all(
    relayURLs.map((url) =>
      fetchEventsWithTimeout(url, timeout, timeout, filters)
    )
  );
  return uniqueEvents(notes);
};

interface Nostr {
  getPublicKey(): Promise<string>;
  signEvent(event: EventTemplate): Promise<NostrEvent>;
}

const getNostrPromise = (): Promise<Nostr> => {
  return new Promise((resolve) => {
    resolve(getNostr());
  });
};

const getNostr = (): Nostr => {
  if (typeof window === "undefined") {
    throw "missing window object";
  }
  if (typeof window["nostr"] === "undefined") {
    throw "Missing Nostr plugin, please install! (e.g. https://getalby.com)";
  }

  return window["nostr"];
};
