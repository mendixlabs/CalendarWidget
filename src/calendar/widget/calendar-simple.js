define([
    "dojo/_base/declare",
    "calendar/widget/calendar",
], function (declare, calendarWidget) {
    "use strict";

    return declare("calendar.widget.calendar-simple", [calendarWidget], {

        dataSourceType: "simple"

    });
});

require(["calendar/widget/calendar-simple"]);
