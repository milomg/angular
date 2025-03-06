import { afterNextRender, Component, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { SignalsGraphVisualizer } from './signals-visualizer';
import { DirectivePosition, Events, MessageBus } from 'protocol';

@Component({
  templateUrl: './signals-tab.component.html',
  selector: 'ng-signals-tab',
  imports: [],
})
export class SignalsTabComponent {
  private svgComponent = viewChild.required<ElementRef>('component');
  private groupComponent = viewChild.required<ElementRef>('group');

  signalsVisualzer!: SignalsGraphVisualizer;

  private readonly _messageBus = inject<MessageBus<Events>>(MessageBus);

  private watchedSignals = new Set();

  constructor() {
    afterNextRender({
      write: () => {
        this.setUpSignalsVisualizer();
      },
    });
  }

  setUpSignalsVisualizer() {
    this.signalsVisualzer = new SignalsGraphVisualizer(
      this.svgComponent().nativeElement,
      this.groupComponent().nativeElement,
    );
  }

  addSignal(s: { nodePath: string[], directivePosition: DirectivePosition }) {
    if (this.watchedSignals.has(s)) {
      return;
    }

    this.watchedSignals.add(s)

    this._messageBus.emit('watchSignal', [{
      directivePosition: s.directivePosition,
      nodePath: s.nodePath
    }])
  }
}
