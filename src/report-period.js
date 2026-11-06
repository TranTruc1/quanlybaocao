export function reportDueDate(today){const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-1);return date.toISOString().slice(0,10);}
export function defaultReportPeriod(detail,today){const due=reportDueDate(today);return {mode:detail?'day':'month',date:due,from:due,to:due,month:today.slice(0,7),product:'all',automaticDue:detail};}
