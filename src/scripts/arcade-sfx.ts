type OscillatorWave = OscillatorType;

const AudioContextConstructor = window.AudioContext;
let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = false;

function getAudioContext(): AudioContext | null {
	if (!AudioContextConstructor) {
		return null;
	}

	audioContext ??= new AudioContextConstructor();
	if (!masterGain) {
		masterGain = audioContext.createGain();
		masterGain.gain.value = muted ? 0 : 1;
		masterGain.connect(audioContext.destination);
	}
	if (audioContext.state === 'suspended') {
		void audioContext.resume().catch((error: unknown) => {
			console.warn('Unable to resume arcade audio.', error);
		});
	}
	return audioContext;
}

function playTone(
	frequency: number,
	startTime: number,
	duration: number,
	wave: OscillatorWave = 'square',
	volume = 0.12,
	endFrequency = frequency,
): void {
	if (muted) {
		return;
	}

	const context = getAudioContext();
	if (!context) {
		return;
	}

	const oscillator = context.createOscillator();
	const gain = context.createGain();
	const endTime = startTime + duration;

	oscillator.type = wave;
	oscillator.frequency.setValueAtTime(frequency, startTime);
	if (endFrequency !== frequency) {
		oscillator.frequency.exponentialRampToValueAtTime(endFrequency, endTime);
	}
	gain.gain.setValueAtTime(0.0001, startTime);
	gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.012);
	gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
	oscillator.connect(gain);
	gain.connect(masterGain ?? context.destination);
	oscillator.start(startTime);
	oscillator.stop(endTime + 0.015);
	oscillator.addEventListener('ended', () => {
		oscillator.disconnect();
		gain.disconnect();
	}, { once: true });
}

export function playCoinClick(): void {
	if (muted) {
		return;
	}
	const context = getAudioContext();
	if (!context) {
		return;
	}

	const now = context.currentTime;
	playTone(880, now, 0.055, 'square', 0.08);
	playTone(1320, now + 0.045, 0.075, 'square', 0.06);
}

export function playPowerUp(): void {
	if (muted) {
		return;
	}
	const context = getAudioContext();
	if (!context) {
		return;
	}

	const now = context.currentTime;
	[440, 554.37, 659.25, 880].forEach((frequency, index) => {
		playTone(frequency, now + index * 0.095, 0.14, 'triangle', 0.07);
	});
}

export function playStatHit(): void {
	if (muted) {
		return;
	}
	const context = getAudioContext();
	if (!context) {
		return;
	}

	const now = context.currentTime;
	playTone(190, now, 0.11, 'square', 0.12, 72);
	playTone(640, now + 0.015, 0.07, 'triangle', 0.05, 320);
}

export function playVictoryFanfare(): void {
	if (muted) {
		return;
	}
	const context = getAudioContext();
	if (!context) {
		return;
	}

	const now = context.currentTime;
	const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
	notes.forEach((frequency, index) => {
		playTone(frequency, now + index * 0.13, index === notes.length - 1 ? 0.32 : 0.11, 'square', 0.075);
	});
	playTone(261.63, now + 0.52, 0.42, 'triangle', 0.045);
}

export function setMuted(value: boolean): void {
	muted = value;
	if (masterGain && audioContext) {
		masterGain.gain.cancelScheduledValues(audioContext.currentTime);
		masterGain.gain.setTargetAtTime(muted ? 0 : 1, audioContext.currentTime, 0.015);
	}
}

export function isMuted(): boolean {
	return muted;
}
