define([
    "dojo/_base/declare",
    "calendar/widget/calendar",
    "calendar/lib/scheduler"
], function (declare, calendarWidget, scheduler) {
    "use strict";

    return declare("calendar.widget.calendar-scheduler", [calendarWidget], {

    });
});

require(["calendar/widget/calendar-scheduler"]);
