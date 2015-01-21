/*jslint white: true nomen: true plusplus: true */
/*global mx, mxui, mendix, dojo, require, console, define, module, logger, setTimeout */

/**

	WidgetName
	========================

	@file      : calendar.js
	@version   : 3.7
	@author    : Pauline Oudeman - van der Kraats, Robert van 't Hof, Richard Edens, Roeland Salij
	@date      : 10-12-2014
	@copyright : Mendix Technology BV
	@license   : Apache License, Version 2.0, January 2004

	Documentation
    ========================
	FullCalendar implmentation.

*/

(function() {
    'use strict';

    // test 
    require([

        'mxui/widget/_WidgetBase', 'dijit/_Widget', 'dijit/_TemplatedMixin',
        'mxui/dom', 'dojo/dom', 'dojo/query', 'dojo/dom-prop', 'dojo/dom-geometry', 'dojo/dom-class', 'dojo/dom-style', 'dojo/on', 'dojo/_base/lang', 'dojo/_base/declare', 'dojo/text', 'dojo/dom-construct',
        'calendar/widget/lib/jquery'

    ], function (_WidgetBase, _Widget, _Templated, domMx, dom, domQuery, domProp, domGeom, domClass, domStyle, on, lang, declare, text, domConstruct, _jQuery) {

        // Declare widget.
        return declare('calendar.widget.calendar', [ _WidgetBase, _Widget, _Templated, _jQuery], {

            /**
             * Internal variables.
             * ======================
             */
            _mxObj          : null,
            _calendarBox    : null,
            _subscription   : null,
            _header         : null,
            _buttonText     : null, 
            _hasStarted     : null,
            _eventIsClicked : false,
            _titleFormat    : null,
            _dateFormat     : null,
            _timeFormat     : null,
            _colors         : null,
            _eventSource    : null,
            _fcNode         : null,
            _availableViews : null,

            // Template path
            templatePath: dojo.moduleUrl('calendar', 'widget/templates/calendar.html'),
            
            /**
             * Mendix Widget methods.
             * ======================
             */
            startup : function() {

                if (this._hasStarted){
                    return;
                }

                this._setupWidget();

                var $ = this.$;
                
                this._hasStarted = true;

                this._colors = this.notused; //workaround for legacy users
                this._availableViews = this.notused1;//workaround for legacy users
                this._setDefaults(); //set default formatting options

                this._eventSource = [];

                //make a calendarbox
                this._calendarBox = mxui.dom.create('div', {'id' : 'calendar_' + this.id});
                domConstruct.place(this._calendarBox, this.domNode);

                this._fcNode = $('#calendar_' + this.id);

                this._renderCalendar(null);

                //subscribe to changes in the event entity. 
                this._subscription = mx.data.subscribe({
                    entity: this.eventEntity,
                    callback: lang.hitch(this, function(entity) {
                        //we re-fetch the objects, and refresh them on the calendar
                        this._fetchObjects();
                    })
                });
                
            },

            update : function(obj, callback) {
                this._mxObj = obj;

                this._fetchObjects();

                if (typeof callback !== 'undefined') {
                    callback();
                }
            }, 
            
            /**
             * Custom Widget methods.
             * ======================
             */
            _setupWidget: function () {

                // Setup jQuery
                this.$ = _jQuery().jQuery();
            },
            
            _fetchObjects : function () {
                
                var constraint = null,
                    expectObj = null,
                    xpath = null,
                    errordiv = null;
                
                if (this.dataSourceType === "xpath") {
                    constraint = this.eventConstraint;
                    expectObj = this.eventConstraint.indexOf('[%CurrentObject%]') >= 0;

                    if(this._mxObj && expectObj){
                        constraint = this.eventConstraint.replace(/\[%CurrentObject%\]/gi, this._mxObj.getGuid());
                    } else if (expectObj) {
                        this._clearCalendar();
                        return;
                    }

                    xpath = '//' + this.eventEntity + constraint;
                    mx.data.get({
                        xpath : xpath,
                        callback : lang.hitch(this, this._prepareEvents)
                    }, this);
                }
                else if (this.dataSourceType === "contextmf" && this.contextDatasourceMf) {
					
					if(this._mxObj) {
                    	this._execMF(this._mxObj, this.contextDatasourceMf, lang.hitch(this, this._prepareEvents));
					}
                }
                else if(this.dataSourceType === "mf" && this.datasourceMf) {
                    this._execMF(null, this.datasourceMf, lang.hitch(this, this._prepareEvents));
                }
                else {
					
                    domConstruct.empty(this.domNode);
					if (this.dataSourceType === "contextmf") {
                    	errordiv = mxui.dom.div("Data source type 'Microflow with context object' is selected, but no microflow was specified for property 'Dataview data source microflow'");
					}
					else if(this.dataSourceType === "mf") {
						errordiv = mxui.dom.div("Data source type 'Microflow' is selected, but no microflow was specified for property 'Data source microflow'");
					}
							
                    domStyle.set(errordiv, {
                        "border" : "1px solid red",
                        "color" : "red",
                        "padding" : "5px"
                    });
                    this.domNode.appendChild(errordiv);
                }
            }, 

            _clearCalendar : function() {
                if (this._fcNode) {
                    this._fcNode.fullCalendar('removeEvents');
                }
            },

            _prepareEvents : function(objs) {
                
                var $ = this.$,
                    objTitles = null,
                    objRefs = null,
                    refTitles = null,
                    split = null,
                    thisRef = null;

                objTitles = {};
                objRefs = [];
                refTitles = {};
                split = this.titleAttr.split("/");
                thisRef = null; 
                
                if (split.length === 1 ) {
                    // titleAttr is a simple attribute and the key of objTitles is
                    // the GUID of the object and the title is the attribute.
                    $.each(objs, lang.hitch(this, function(index, obj){
                        objTitles[obj.getGUID()] = obj.get(this.titleAttr);
                    }));
                    this._createEvents(objs, objTitles);
                } else if (split.length === 3 ) {
                    
                    // titleAttr is a reference and we have more work to do.
                    $.each(objs, function(index, obj){
                        thisRef = obj.getAttribute(split[0]);
                        objTitles[obj.getGUID()] = thisRef;
                        // objRefs should only contain the unique list of referred objects.
                        if (objRefs.indexOf(thisRef) < 0) {
                            objRefs.push(thisRef);
                        }
                    });
                    // Now get the actual title strings from the list of referred objects ...
                    // This is an asynchronous call.
                    mx.data.get({
                        guids : objRefs,
                        nocache : false,
                        callback : function (refObjs) {
                            var i = null,
                                index = null,
                                thisValue = null;
                            
                            // Get the title string for each referenced object and store it
                            // as the value in the refTitles array.
                            for (i = 0; i < refObjs.length; i++ ) {
                                refTitles[refObjs[i].getGUID()] = refObjs[i].get(split[2]);
                            }
                            // Now, loop through the objTitles array and replace the value (which is
                            // is the GUID of the referred object) with the actual title string extracted
                            // from the referred object.
                            for (index in objTitles) {
                                    if (objTitles.hasOwnProperty(index)) {
                                    thisValue = objTitles[index];
                                    objTitles[index] = refTitles[objTitles[index]];
                                }
                            }
                            // Now that we finally have all of the referenced titles, we can call
                            // createEvents()
                            this._createEvents(objs, objTitles);
                            
                        }
                    }, this);
                    //this._createEvents(objs, objTitles);
                } else {
                    // this should never happen and is likely an error
                    console.error("Error in titleAttr: " + this.titleAttr+". This should be either a simple attribute or a 1-deep reference.");
                }
            },

            _createEvents : function(objs, titles) {
                var $ = this.$,
                    events = [],
                    objcolors = null;
                
                $.each(objs, lang.hitch(this, function(index, obj){
                    //get the colors
                    if(this._colors.length > 0 && this.typeAttr){
                        objcolors = this._getObjectColors(obj);
                    }
                    //get the dates
                    var start = new Date(obj.get(this.startAttr)),
                        end = new Date(obj.get(this.endAttr)),
                    
                    //create a new calendar event
                        newEvent = {
                            title : titles[obj.getGUID()],
                            start : start,
                            end	: end,
                            allDay : obj.get(this.alldayAttr),
                            editable : this.editable, 
                            mxobject: obj //we add the mxobject to be able to handle events with relative ease.
                        };

                    if(objcolors){
                        newEvent.backgroundColor = objcolors.backgroundColor;
                        newEvent.borderColor = objcolors.borderColor;
                        newEvent.textColor = objcolors.textColor;
                    }
                    events.push(newEvent);
                }));
                //check if the calendar already exists (are we just updating events here?)
                if(this._fcNode.hasClass('fc')){
                    //if it does, remove, add the new source and refetch
                    this._fcNode.fullCalendar('render');
                    if (this._eventSource && this._eventSource.length >= 1) {
                        this._fcNode.fullCalendar('removeEventSource', this._eventSource);
                    }

                    this._fcNode.fullCalendar('addEventSource', events);
                    this._fcNode.fullCalendar('refetchEvents');
                } else {
                    //else create the calendar
                    this._renderCalendar(events);
                }
                this._eventSource = events;
            },

            _renderCalendar: function (events) {			
                var options = this._setCalendarOptions(events);

                this._fcNode.fullCalendar(options);

                //go to the startposition if we have one
                if (this._mxObj && this._mxObj.get(this.startPos)) {
                    this._fcNode.fullCalendar('gotoDate', new Date(this._mxObj.get(this.startPos)));
                }
            }, 

            _onEventChange : function(event,dayDelta,minuteDelta,allDay,revertFunc){ 
                var obj = event.mxobject;
                this._setVariables(obj, event, allDay);
                this._execMFFromUI(obj, this.onchangemf);
            }, 

            _onEventClick : function(event) {
                var obj = event.mxobject;
                this._setVariables(obj, event);
                this._execMFFromUI(obj, this.onclickmf);
            },

            _onSelectionMade : function(startDate, endDate, allDay, jsEvent, view) {
                var eventData = {
                    start : startDate,
                    end	: endDate
                };

                if(!this._eventIsClicked){

                    mx.data.create({
                        entity: this.eventEntity,
                        callback: function(obj) {
                            this._setVariables(obj, eventData, allDay);
                            if(this._mxObj && this.neweventref !== '') {
                                obj.addReference(this.neweventref.split('/')[0], this._mxObj.getGuid());
                            }
                            this._execMF(obj, this.neweventmf);
                        },
                        error: function(err){ 
                            logger.warn('Error creating object: ', err);
                        }
                    }, this);

                    this._eventIsClicked = true;

                    setTimeout( lang.hitch(this,function(){
                        this._eventIsClicked = false;
                    }),1000);
                }
            },

            _getObjectColors : function(obj){
                var $ = this.$,
                    objcolors = null;

                $.each(this._colors, lang.hitch(this, function(index, color) {
                    //set color when enum color equals the color we have on file
                    if(obj.get(this.typeAttr) === color.enumKey){
                        objcolors = {
                            backgroundColor : color.bgColor,
                            borderColor : color.border,
                            textColor : color.textColor
                        };
                    }
                }));

                return objcolors;
            },

            _setVariables : function(obj, event, allDay){
                //update the mx object
                obj.set(this.startAttr, event.start);
                if (event.end !== null) {
                    obj.set(this.endAttr, event.end);
                }

                if(allDay !== null){
                    obj.set(this.alldayAttr, allDay);
                }
            },

            _setDefaults : function(){
                var $ = this.$,
                    views = [];

                this._header = {
                    left: 'title',
                    center: ''
                };

                this._titleFormat = {
                    month: 'MMMM yyyy',                             // September 2009
                    week: "MMM d[ yyyy]{ '&#8212;'[ MMM] d yyyy}", // Sep 7 - 13 2009
                    day: 'dddd, MMM d, yyyy'                  // Tuesday, Sep 8, 2009
                };
                
                if(this.titleFormat){
                    this._titleFormat[''] = this.titleFormat ;
                }
                
                this._dateFormat = this.dateFormat || {
                    month: 'ddd',    // Mon
                    week: 'ddd M/d', // Mon 9/7
                    day: 'dddd M/d'  // Monday 9/7
                };
                
                if(this.dateFormat){
                    this._dateFormat[''] = this.dateFormat ;
                }
                
                this._timeFormat =  {};
                if(this.timeFormat){
                    this._timeFormat[''] = this.timeFormat ;
                }

                this._buttonText = {};

                this.axisFormat = this.axisFormat || 'h(:mm)tt' ;

                if(this._availableViews.length > 0){
                    //fill default specifics				
                    $.each(this._availableViews, lang.hitch(this,function(index, view){
                        var viewName = view.availableViews;
                        views.push(viewName);
                        if(view.titleFormatViews !== ''){
                            this._titleFormat[viewName] = view.titleFormatViews;
                        }
                        if(view.dateFormatViews !== '') {
                            this._dateFormat[viewName] = view.dateFormatViews;
                        }
                        if(view.timeFormatViews !== '') {
                            this._timeFormat[viewName] = view.timeFormatViews;
                        }

                        if(view.labelViews !== '') {
                            this._buttonText[viewName] = view.labelViews;
                        }
                    }));

                } 

                if(this.todaycaption){
                    this._buttonText.today = this.todaycaption;
                }

                this._header.right = 'today '+ views.join() +' prev,next';		

                this.monthNamesFormat = this.monthNamesFormat ? this.monthNamesFormat.split(",") : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                this.monthShortNamesFormat = this.monthShortNamesFormat ? this.monthShortNamesFormat.split(",") : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                this.dayNamesFormat = this.dayNamesFormat ? this.dayNamesFormat.split(",") : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                this.dayShortNamesFormat = this.dayShortNamesFormat ? this.dayShortNamesFormat.split(",") : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            },

            _setCalendarOptions : function(events){
                var options = {
                    //contents
                    header : this._header,
                    events: events,
                    //configs
                    editable: true, //allows resizing events
                    selectable: true, //allows selecting a portion of the day or one or multiple days (based on the view)
                    //event handling
                    eventResize: lang.hitch(this, this._onEventChange), //is called when an event is dragged and has changed
                    eventDrop: lang.hitch(this, this._onEventChange), //is called when an event is dragged and has changed
                    eventClick: lang.hitch(this, this._onEventClick), //is called when an event is clicked
                    select: lang.hitch(this, this._onSelectionMade), //is called after a selection has been made
                    //appearance
                    defaultView: this.defaultView,
                    firstDay: this.firstday,
                    height: this.calHeight, 
                    weekNumbers: this.showWeekNumbers,
                    weekNumberTitle: this.weeknumberTitle, 
                    weekends: this.showWeekends,
                    slotMinutes: this.slotMinutes,
                    buttonText: this._buttonText,
                    //Agenda view formatting
                    axisFormat: this.axisFormat,
                    //Text/Time Formatting
                    titleFormat: this._titleFormat,
                    timeFormat: this._timeFormat,
                    columnFormat: this._dateFormat,
                    monthNames: this.monthNamesFormat, 
                    monthNamesShort: this.monthShortNamesFormat,
                    dayNames: this.dayNamesFormat,
                    dayNamesShort: this.dayShortNamesFormat,
                    minTime : this.startTime || 0,
                    maxTime : this.endTime || 24
                };
                
                if (this.alldaycaption) {
                    options.allDayText = this.alldaycaption;
                }
                
                return options;
            },

            _execMF : function (obj, mf, cb) {
                if (mf) {
                    var params = {
                        applyto : "selection",
                        actionname : mf,
                        guids : []
                    };
                    if (obj){
                        params.guids = [obj.getGuid()];
                    }
                    mx.data.action({
                        params : params,
                        callback	: function(objs) {
                            if (cb) {
                                cb(objs);
                            }
                        },
                        error	: function(error) {
                            if (cb) {
                                cb();
                            }
                            logger.warn(error.description);
                        }
                    }, this);
                    
                } else if (cb) {
                    cb();
                }
            }, 

            _execMFFromUI : function (obj, mf, cb) {
                if (mf) {
                    var params = {
                        applyto		: "selection",
                        guids : []
                    };
                    if (obj) {
                        params.guids = [obj.getGuid()];
                    }

                    mx.ui.action(mf, {
                        context: new mendix.lib.MxContext(),
                        progress: "modal",
                        params	: params,	
                        callback: function(result) {
                            if (cb) {
                                cb(result);
                            }
                        }
                    });

                } else if (cb) {
                    cb();
                }

            }, 

            uninitialize: function(){
                mx.data.unsubscribe(this._subscription);
            }

        });
    });

}());