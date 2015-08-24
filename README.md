# Calendar Widget
This is a calendar widget for Mendix. It shows a Calendar and can render objects as events in it.

## Contributing
For more information on contributing to this repository visit [Contributing to a GitHub repository](https://world.mendix.com/display/howto50/Contributing+to+a+GitHub+repository)!

## Dependencies
- FullCalendar v2.3.2
- JQuery v2.1.3
- Moments.js v2.9.0

## Features
The Calendar Widget is a Mendix implementation of the open-source jQuery widget [FullCalendar](http://fullcalendar.io/).

## Configuration
### Data source
#### Data source type
This widget supports 4 types of data source. All these require the Event Entity to be set.

The default is 'XPath retrieve'. This can be combined with an optional XPath Constraint.

The 'Microflow' option uses the 'Data source microflow' to fill the events for the calendar. Make sure this microflow returns a list of objects of the same type as the 'Event Entity'.

The 'Microflow with context object' lets you pass a context object (from a Dataview) to the microflow to retrieve the events. When using this option, you can use the 'Dataview Context (Optional)' options to set up the configuration for this. Make sure this microflow returns a list of objects of the same type as the 'Event Entity'.

*NEW* The 'Microflow with context object (Retrieve events for each view)' does the same as the above version, but this one lets you filter them based on the current view. This requires the 'Reference to ViewRender entity (if used)' to be set. This reference will be set and the referenced ViewRender object will contain the Start and End datetime needed to constrain the events on. The normal 'Dataview data source microflow' is still used for this retrieve.

#### Event Entity
The entity for the Event objects that will be shown on the Calendar.

#### XPath Constraint
An optional XPath constraint. This is only used when the data source type is set to 'XPath retrieve'.

#### Data source microflow
The microflow to fill the Calendar. Only used when the Data source type is set to 'Microflow'. Make sure this microflow returns a list of objects of the same type as the 'Event Entity'.

### Dataview context (Optional)
These options are only applicable if the 'Data source type' is set to 'Microflow with context object'.

#### Dataview Entity
The entity of the dataview in which the Calendar widget is placed.

#### Reference to ViewRender entity (if used)
This reference will be used to link the ViewRender object to the context object, so that it can be retrieved in the datasource microflow.

#### Start pos attribute
This option lets you specify an attribute of the Dataview object to be used as the start position where the Calendar opens.

#### Dataview data source microflow
The microflow to fill the Calendar. Only used when the Data source type is set to 'Microflow with context object' and should have one input parameter, matching with the 'Dataview Entity'. Make sure this microflow returns a list of objects of the same type as the 'Event Entity'.

### Event Data
#### Title
The String attribute that contains the title for the event.

#### Start
The DateTime attribute that contains the Start date for the event.

#### End
The DateTime attribute that contains the End date for the event.

#### All Day
The Boolean attribute that specifies if the event is an All Day event, or at a specific time that day.

#### Editable
Boolean to set if the user is allowed to change the events using drag and drop.

### Behaviour
#### On change
A microflow that is triggered whenever an event is changed through drag and drop. The microflow gets the Event object as input parameter. (Only works if 'Editable' is set to True)

#### On click
A microflow that is triggered when an event is clicked. The microflow gets the Event object as input parameter.

#### New event
A microflow that is triggered when the user clicks somewhere in the calendar where there is no event yet. This will create a new object of the same entity as the 'Event entity' with the Start attribute filled with the date that was clicked, and send this to the microflow as input parameter.

#### New event reference
This reference can be configured from the Event entity to the context object and will be set when a new Event is created by clicking in the Calendar.

#### Start view
The view that the Calendar should start on.

### View settings

#### Height
The height of the Calendar in pixels.

#### Show weeknumbers
This boolean lets you turn the weeknumbers on and off.

#### Weeknumber Title
The title for the column with the weeknumbers. This defaults to a simple 'W'.

#### Enum for colors
You can set an enumeration here (an attribute on the Event Entity) to specify the color for each event. The enumeration key has to match with one of the colors specified under 'Colors'.

#### Colors
A list of event color combinations and their matching Enumeration key, as set in 'Enum for colors'.

#### Show weekends
A boolean to set if the weekends should be shown on the Calendar.

#### First day of the week
An integer to set what the first day of the week is, where 0 = Sunday, 1 = Monday, etc.

#### Custom time format
Default: h:mm{ - h:mm}. For more information: http://fullcalendar.io/docs/text/timeFormat/

#### Custom date format
The date format that is shown in the column headings. For more information: http://fullcalendar.io/docs/text/columnFormat/

#### Custom title format
The header title format that is shown in the header's title. For more information: http://fullcalendar.io/docs/text/titleFormat/

#### Month names format
A translatable string of all the month names that are used in the Calendar.

#### Month short names format
A translatable string of all the shorthand month names that are used in the Calendar.

#### Day names format
A translatable string of all the day names that are used in the Calendar.

#### Day short names format
A translatable string of all the shorthand day names that are used in the Calendar.

### Extra
#### Available views
A list of which views should be available to the user in the Calendar (Month, Basic Week, Agenda Week, Basic Day, Agenda Day). For more information: http://fullcalendar.io/docs/views/Available_Views/

##### Custom time format
Default: h:mm{ - h:mm}. Overrides the 'general' custom time format property. For more information: http://arshaw.com/fullcalendar/docs/text/timeFormat/

##### Custom date format
For more information: http://arshaw.com/fullcalendar/docs/text/columnFormat/

##### Custom title format
For more information: http://arshaw.com/fullcalendar/docs/text/titleFormat/

##### Label
Caption used for the 'calendar view' button. For more information: http://fullcalendar.io/docs/text/buttonText/

#### Agenda Axis Format
The format of the vertical axis labels in agenda views (default h(:mm)tt)

#### Slot duration
The time interval (in minutes) of day and week calendars. (Default: 30)

#### Today button caption
Caption on button which jumps to today. Default: Today

#### All-day title caption
The text titling the "all-day" slot at the top of the calendar. Default: all-day. This option only applies to Agendaweek en AgendaDay views.

#### Start time
The start time for each day. This property only applies to Agendaweek en AgendaDay views.

#### End time
The end time for each day. This property only applies to Agendaweek en AgendaDay views.

### View change
This callback will get triggered when the user changes the view, or when any of the date navigation methods are called.

#### On view change
Microflow triggered when a new date-range is rendered, or when the view type switches.(http://fullcalendar.io/docs/display/viewRender/)

#### Entity
The entity being passed to the on view change microflow. Reflecting the view change start and end date.

#### Start date
The starting date of the view (fullcalendar's intervalStart of the view). E.g. first day of the month when rendering month view.

#### End date
The end date of the view (fullcalendar's intervalEnd of the view). E.g. last day of the month when rendering month view.
