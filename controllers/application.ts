import { Application } from "@hotwired/stimulus";
import { timeHelpersTest } from "./time_helpers";

const application = window["Stimulus"]
  ? window["Stimulus"]
  : Application.start();

// Configure Stimulus development experience
application.debug = false;
window["Stimulus"] = application;

import FormController from "./form_controller";
application.register("form", FormController);

timeHelpersTest();
