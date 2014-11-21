# Calendar Widget
This is a calendar widget for Mendix. It shows a Calendar and can render objects as events in it.

## Contributing
For more information on contributing to this repository visit [Contributing to a GitHub repository](https://world.mendix.com/display/howto50/Contributing+to+a+GitHub+repository)!

## Features
The Calendar Widget is a Mendix implementation of the open-source jQuery widget [FullCalendar](http://fullcalendar.io/).

## Configuration
### Data source
#### Data source type
This widget supports 3 types of data source. All these require the Event Entity to be set.

The default is 'XPath retrieve'. This can be combined with an optional XPath Constraint.

The 'Microflow' option uses the 'Data source microflow' to fill the events for the calendar. Make sure this microflow returns a list of objects of the same type as the 'Event Entity'.

The 'Microflow with context object' lets you pass a context object (from a Dataview) to the microflow to retrieve the events. When using this option, you can use the 'Dataview Context (Optional)' options to set up the configuration for this. Make sure this microflow returns a list of objects of the same type as the 'Event Entity'.

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
The time format for all events. For more information: http://fullcalendar.io/docs/text/timeFormat/

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