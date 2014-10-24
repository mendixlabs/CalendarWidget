mxui.dom.addCss(dojo.moduleUrl("calendar.lib", "fullcalendar.css"));
dojo.require("calendar.lib.jquery-min");
dojo.require("calendar.lib.jquery-ui-min");
dojo.require("calendar.lib.fullcalendar-min");


//TODO: MASSIVE cleanup for MX5



(function($) {
	dojo.declare("calendar.widget.calendar", mxui.widget._WidgetBase, {
		_mxObj			: null,
		_calendarBox	: null,
		_subscription	: null,
		_header			: null,
		colors			: null,

		postCreate : function() {
			this.colors = this.notused; //workaround for legacy users
			this.availableViews = this.notused1;//workaround for legacy users
			this.setDefaults(); //set default formatting options

			//make a calendarbox
			this._calendarBox = dojo.create('div', {'id' : 'calendar_' + this.id});
			dojo.place(this._calendarBox, this.domNode);
			//subscribe to changes in the event entity. 
			this._subscription = mx.data.subscribe({
				entity: this.eventEntity,
				callback: dojo.hitch(this, function(entity) {
					//we re-fetch the objects, and refresh them on the calendar
					this.fetchObjects();
				})
			});
			this.actLoaded();
		},

		update : function(obj, callback) {
			if(obj){
				this._mxObj = obj;
			} 
			this.fetchObjects();
			callback && callback();
		}, 
		
		fetchObjects : function () {
			if (this.dataSourceType === "xpath") {
				var constraint = this.eventConstraint;
				//when in a dataview
				if(this._mxObj){
					constraint = this.eventConstraint.replace('[%CurrentObject%]', this._mxObj.getGuid());
				}
				
				var xpath = '//' + this.eventEntity + constraint;
				mx.data.get({
					xpath : xpath,
					callback : dojo.hitch(this, this.createEvents)
				}, this);
			}
			else if(this.dataSourceType === "mf" && this._mxObj && this.datasourceMf)
				this.execMF(this._mxObj, this.datasourceMf, dojo.hitch(this, this.createEvents));
			else if (this.dataSourceType === "contextmf" && this._mxObj && this.contextDatasourceMf)
				this.execMF(this._mxObj, this.contextDatasourceMf, dojo.hitch(this, this.createEvents));
			else {
				dojo.empty(this.domNode);
				var errordiv = mxui.dom.div("Your data source settings do not seem to match up. Please re-configure them.");
				dojo.style(errordiv, {
					"border" : "1px solid red",
					"color" : "red",
					"padding" : "5px"
				});
				this.domNode.appendChild(errordiv);
			}
		}, 

		createEvents : function(objs) {
			var events = [];
			var objcolors = null;
			var self = this;
			$.each(objs, function(index, obj){
				//get the colors
				if(self.colors.length > 0 && self.typeAttr){
					objcolors = self.getObjectColors(obj);
				}
				//get the dates
				var start = new Date(obj.get(self.startAttr));
				var end = new Date(obj.get(self.endAttr));
				//create a new calendar event
				var newEvent = {
					title : obj.get(self.titleAttr),
					start : start,
					end	: end,
					allDay : obj.get(self.alldayAttr),
					editable : self.editable, 
					mxobject: obj //we add the mxobject to be able to handle events with relative ease.
				};

				if(objcolors){
					newEvent.backgroundColor = objcolors.backgroundColor;
					newEvent.borderColor = objcolors.borderColor;
					newEvent.textColor = objcolors.textColor;
				}

				events.push(newEvent);
			});
			//check if the calendar already exists (are we just updating events here?)
			if($('#calendar_' + this.id).hasClass('fc')){
				//if it does, remove, add the new source and refetch				
				$('#calendar_' + this.id).fullCalendar('removeEvents');
				$('#calendar_' + this.id).fullCalendar('addEventSource', events);
				$('#calendar_' + this.id).fullCalendar('refetchEvents');
			} else {
				//else create the calendar
				this.renderCalendar(events);
			}
		},

		renderCalendar: function (events) {			
			var options = this.setCalendarOptions(events);

			$('#calendar_' + this.id).fullCalendar(options);

			//go to the startposition if we have one

			if (this._mxObj && this._mxObj.get(this.startPos)) {
				$('#calendar_' + this.id).fullCalendar('gotoDate', new Date(this._mxObj.get(this.startPos)));
			}
		}, 

		onEventChange : function(event,dayDelta,minuteDelta,allDay,revertFunc){ 
			var obj = event.mxobject;
			this.setVariables(obj, event, allDay);
			this.execMF(obj, this.onchangemf);
		}, 

		onEventClick : function(event) {
			var obj = event.mxobject;
			this.setVariables(obj, event);
			this.execMF(obj, this.onclickmf);
		},

		onSelectionMade : function(startDate, endDate, allDay, jsEvent, view) {
			var eventData = {
				start : startDate,
				end	: endDate
			};
			mx.data.create({
				entity: this.eventEntity,
				callback: function(obj) {
					this.setVariables(obj, eventData, allDay);
					if(this._mxObj && this.neweventref !== '') {
						obj.addReference(this.neweventref.split('/')[0], this._mxObj.getGuid());
					}
					this.execMF(obj, this.neweventmf);
				},
				error: function(err){ 
					logger.warn('Error creating object: ', err);
				}
			}, this);
		},

		getObjectColors : function(obj){
			var objcolors = null;
			var self = this;
			$.each(this.colors, function(index, color){
				//set color when enum color equals the color we have on file
				if(obj.get(self.typeAttr) === color.enumKey){
					objcolors = {
						backgroundColor : color.bgColor,
						borderColor : color.border,
						textColor : color.textColor
					};
				}
			});

			return objcolors;
		},

		setVariables : function(obj, event, allDay){
			//update the mx object
			obj.set(this.startAttr, event.start);
			if (event.end !== null)
				obj.set(this.endAttr, event.end);

			if(allDay !== null){
				obj.set(this.alldayAttr, allDay);
			}
		},

		setDefaults : function(){
			var views = [];

			this._header = {
				left: 'title',
				center: ''
			};

			this.titleFormat = this.titleFormat ? this.titleFormat : {
				month: 'MMMM yyyy',                             // September 2009
				week: "MMM d[ yyyy]{ '&#8212;'[ MMM] d yyyy}", // Sep 7 - 13 2009
				day: 'dddd, MMM d, yyyy'                  // Tuesday, Sep 8, 2009
			};
			this.dateFormat = this.dateFormat ? this.dateFormat : {
				month: 'ddd',    // Mon
				week: 'ddd M/d', // Mon 9/7
				day: 'dddd M/d'  // Monday 9/7
			};
			this.timeFormat = {
				'' : this.timeFormat
			};

			var self = this;
			
			if(this.availableViews.length > 0){
				//fill default specifics				
				$.each(this.availableViews, function(index, view){
					var viewName = view.availableViews;
					views.push(viewName);
					if(view.titleFormatViews !== ''){
						self.titleFormat[viewName] = view.titleFormatViews;
					}
					if(view.dateFormatViews !== '') {
						self.dateFormat[viewName] = view.dateFormatViews;
					}
					if(view.timeFormatViews !== '') {
						self.timeFormat[viewName] = view.timeFormatViews;
					}
					if(view.labelViews !== '') {
						self._header[viewName] = view.labelViews;
					}
				});
			
			} 

			this._header.right = 'today '+ views.join() +' prev,next';		

			this.monthNamesFormat = this.monthNamesFormat ? this.monthNamesFormat : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
			this.monthShortNamesFormat = this.monthShortNamesFormat ? this.monthShortNamesFormat : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			this.dayNamesFormat = this.dayNamesFormat ? this.dayNamesFormat : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Friday', 'Saturday'];
			this.dayShortNamesFormat = this.dayShortNamesFormat ? this.dayShortNamesFormat : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		},

		setCalendarOptions : function(events){
			var options = {
				//contents
				header : this._header,
				events: events,
				//configs
				editable: true, //allows resizing events
				selectable: true, //allows selecting a portion of the day or one or multiple days (based on the view)
				//event handling
                eventResize: dojo.hitch(this, this.onEventChange), //is called when an event is dragged and has changed
				eventDrop: dojo.hitch(this, this.onEventChange), //is called when an event is dragged and has changed
				eventClick: dojo.hitch(this, this.onEventClick), //is called when an event is clicked
				select: dojo.hitch(this, this.onSelectionMade), //is called after a selection has been made
				//appearance
				defaultView: this.defaultView,
				firstDay: this.firstday,
				height: this.calHeight, 
				weekNumbers: this.showWeekNumbers,
				weekNumberTitle: this.weeknumberTitle, 
				weekends: this.showWeekends,
				//Text/Time Formatting
				titleFormat: this.titleFormat,
				timeFormat: this.timeFormat,
				columnFormat: this.dateFormat,
				monthNames: this.monthNamesFormat, 
				monthNamesShort: this.monthShortNamesFormat,
				dayNames: this.dayNamesFormat,
				dayNamesShort: this.dayShortNamesFormat
			};

			return options;
		},

		execMF : function (obj, mf, cb) {
			var params = {
				applyto		: "selection",
				actionname	: mf,
				guids : []
			};
			if (obj)
				params.guids = [obj.getGuid()];

			mx.data.action({
				params			: params,			
				callback		: function(objs) {
					cb && cb(objs);
				},
				error			: function(error) {
					cb  && cb();
					logger.warn(error.description);
				}
			}, this);
		}, 

		uninitialize: function(){
			mx.data.unsubscribe(this._subscription);
		}

	});

})(calendar.lib.$);