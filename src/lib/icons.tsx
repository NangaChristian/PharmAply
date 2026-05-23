import React from 'react';
import { 
  Moon, Activity, Thermometer, Shield, Zap, Baby, 
  Droplet, Eye, HeartPulse, Brain, Syringe, Sparkles, Pill,
  Wind, Leaf, Bone, Ear, Stethoscope, Beaker
} from 'lucide-react';

export const getCategoryIcon = (categoryName: string, size: number = 28, className: string = "") => {
  if (!categoryName) return <Pill size={size} className={className} />;
  const name = categoryName.toLowerCase();
  
  if (name.includes('anesthes') || name.includes('sommeil') || name.includes('sleep') || name.includes('dormir')) {
    return <Moon size={size} className={className} />;
  }
  if (name.includes('gaz') || name.includes('gas') || name.includes('oxygen') || name.includes('respira') || name.includes('asthme')) {
    return <Wind size={size} className={className} />;
  }
  if (name.includes('analge') || name.includes('douleur') || name.includes('pain') || name.includes('maux')) {
    return <Activity size={size} className={className} />;
  }
  if (name.includes('inflammat') || name.includes('fièvre') || name.includes('fever')) {
    return <Thermometer size={size} className={className} />;
  }
  if (name.includes('antidote') || name.includes('bacteri') || name.includes('infecti') || name.includes('viral') || name.includes('fongi') || name.includes('immun') || name.includes('parasit') || name.includes('helminth')) {
    return <Shield size={size} className={className} />;
  }
  if (name.includes('epilep') || name.includes('convulsi')) {
    return <Zap size={size} className={className} />;
  }
  if (name.includes('contracept') || name.includes('grossesse') || name.includes('baby') || name.includes('enfant')) {
    return <Baby size={size} className={className} />;
  }
  if (name.includes('laxatif') || name.includes('digesti') || name.includes('estomac') || name.includes('gastr') || name.includes('diarrhe') || name.includes('intestin') || name.includes('ulcere')) {
    return <Droplet size={size} className={className} />;
  }
  if (name.includes('ophtalmo') || name.includes('oeil') || name.includes('yeux') || name.includes('eye')) {
    return <Eye size={size} className={className} />;
  }
  if (name.includes('cardio') || name.includes('tension') || name.includes('coeur') || name.includes('sang') || name.includes('hemo') || name.includes('coagul')) {
    return <HeartPulse size={size} className={className} />;
  }
  if (name.includes('neuro') || name.includes('cerveau') || name.includes('psy') || name.includes('migrain')) {
    return <Brain size={size} className={className} />;
  }
  if (name.includes('diabet') || name.includes('insulin') || name.includes('vaccin') || name.includes('inject')) {
    return <Syringe size={size} className={className} />;
  }
  if (name.includes('allergie') || name.includes('histamin') || name.includes('prurigin') || name.includes('peau') || name.includes('derma') || name.includes('cutane')) {
    return <Sparkles size={size} className={className} />;
  }
  if (name.includes('os') || name.includes('calc') || name.includes('rhumat') || name.includes('joint')) {
    return <Bone size={size} className={className} />;
  }
  if (name.includes('orl') || name.includes('oreille') || name.includes('gorge')) {
    return <Ear size={size} className={className} />;
  }
  if (name.includes('vitamine') || name.includes('nutri') || name.includes('plante') || name.includes('phyto')) {
    return <Leaf size={size} className={className} />;
  }
  if (name.includes('diagnostic')) {
    return <Beaker size={size} className={className} />;
  }
  
  return <Pill size={size} className={className} />;
};
