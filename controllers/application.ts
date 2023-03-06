import { Application } from "@hotwired/stimulus";

const application = window["Stimulus"]
  ? window["Stimulus"]
  : Application.start();

// Configure Stimulus development experience
application.debug = false;
window["Stimulus"] = application;

import FormController from "./form_controller";
application.register("form", FormController);
