import { Controller } from "@hotwired/stimulus";

// Connects to data-controller="form"
export default class extends Controller {
  static values = {};
  static targets = [];

  connect() {
    console.log("form controller connected");
  }
}
