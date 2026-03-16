export namespace git {
	
	export class Branch {
	    Name: string;
	    IsHead: boolean;
	    IsRemote: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Branch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Name = source["Name"];
	        this.IsHead = source["IsHead"];
	        this.IsRemote = source["IsRemote"];
	    }
	}
	export class Commit {
	    Hash: string;
	    Message: string;
	    Author: string;
	    Date: string;
	
	    static createFrom(source: any = {}) {
	        return new Commit(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Hash = source["Hash"];
	        this.Message = source["Message"];
	        this.Author = source["Author"];
	        this.Date = source["Date"];
	    }
	}
	export class HunkLine {
	    Index: number;
	    Type: string;
	    Content: string;
	    OldLineNum: number;
	    NewLineNum: number;
	
	    static createFrom(source: any = {}) {
	        return new HunkLine(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Index = source["Index"];
	        this.Type = source["Type"];
	        this.Content = source["Content"];
	        this.OldLineNum = source["OldLineNum"];
	        this.NewLineNum = source["NewLineNum"];
	    }
	}
	export class DiffHunk {
	    Index: number;
	    Header: string;
	    OldStart: number;
	    OldLines: number;
	    NewStart: number;
	    NewLines: number;
	    Lines: HunkLine[];
	
	    static createFrom(source: any = {}) {
	        return new DiffHunk(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Index = source["Index"];
	        this.Header = source["Header"];
	        this.OldStart = source["OldStart"];
	        this.OldLines = source["OldLines"];
	        this.NewStart = source["NewStart"];
	        this.NewLines = source["NewLines"];
	        this.Lines = this.convertValues(source["Lines"], HunkLine);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class FileStatus {
	    Path: string;
	    Status: string;
	    IsStaged: boolean;
	    IsUntracked: boolean;
	
	    static createFrom(source: any = {}) {
	        return new FileStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Path = source["Path"];
	        this.Status = source["Status"];
	        this.IsStaged = source["IsStaged"];
	        this.IsUntracked = source["IsUntracked"];
	    }
	}
	export class GraphNode {
	    Hash: string;
	    ShortHash: string;
	    Message: string;
	    Author: string;
	    Date: string;
	    Parents: string[];
	    Branches: string[];
	    IsHead: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GraphNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Hash = source["Hash"];
	        this.ShortHash = source["ShortHash"];
	        this.Message = source["Message"];
	        this.Author = source["Author"];
	        this.Date = source["Date"];
	        this.Parents = source["Parents"];
	        this.Branches = source["Branches"];
	        this.IsHead = source["IsHead"];
	    }
	}

}

