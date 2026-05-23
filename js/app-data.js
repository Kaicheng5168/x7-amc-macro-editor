(function () {
  "use strict";

  window.X7AppData = {
    KEYBOARD_GROUPS: [
      {
        className: "keyboard-main",
        rows: [
          [41, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69],
          [53, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 45, 46, 42],
          [43, 20, 26, 8, 21, 23, 28, 24, 12, 18, 19, 47, 48, 49],
          [57, 4, 22, 7, 9, 10, 11, 13, 14, 15, 51, 52, 40],
          [265, 29, 27, 6, 25, 5, 17, 16, 54, 55, 56, 269],
          [264, 267, 266, 44, 270, 271, 268]
        ]
      },
      {
        className: "keyboard-nav",
        rows: [
          [70, 71, 72],
          [73, 74, 75],
          [76, 77, 78],
          [null, 82, null],
          [80, 81, 79]
        ]
      },
      {
        className: "keyboard-numpad",
        rows: [
          [83, 84, 85, 86],
          [95, 96, 97, 87],
          [92, 93, 94, null],
          [89, 90, 91, 88],
          [98, 99, null, null]
        ]
      }
    ],

    AMC_FILE_TYPES: [{
      description: "AMC Macro",
      accept: {
        "application/octet-stream": [".amc"],
        "text/xml": [".xml"]
      }
    }],

    PROJECT_FILE_TYPES: [{
      description: "X7 Project",
      accept: {
        "application/json": [".x7proj", ".json"]
      }
    }],

    MACRO_LIBRARY_PATH: "C:\\Program Files (x86)\\OSCAR Editor  X7\\OSCAR Editor  X7\\ScriptsMacros\\ChineseT\\MacroLibrary",
    PICKER_APP_ID: "x7-amc-coordinate-picker",
    PICKER_CHANNEL_NAME: "x7-amc-coordinate-picker"
  };
})();
