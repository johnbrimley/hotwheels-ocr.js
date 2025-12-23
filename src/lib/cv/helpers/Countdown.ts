export class Countdown{
    private resetCount: number;
    private remaining: number;
    private action: () => void;

    constructor(calls: number, action: () => void){
        this.resetCount = calls;
        this.remaining = calls;
        this.action = action;
    }

    public tick(): void{
        this.remaining--;
        if(this.remaining <= 0){
            this.remaining = this.resetCount;
            this.action();
        }
    }
}